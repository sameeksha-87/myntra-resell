import os
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
import sys
import json
import urllib.request
import io
import base64
import numpy as np
import cv2
from PIL import Image, ImageOps
import torch
import torch.nn.functional as F
import open_clip

# -------------------------------------------------------------
# 1. Fashion YOLO (best.pt) Garment Detection & Crop
# -------------------------------------------------------------
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

import urllib.parse

def load_image(src):
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        if src.startswith('data:image'):
            header, encoded = src.split(',', 1)
            data = base64.b64decode(encoded)
            img = Image.open(io.BytesIO(data))
        elif src.startswith('http://') or src.startswith('https://'):
            if 'localhost' in src or '127.0.0.1' in src:
                parsed = urllib.parse.urlparse(src)
                rel_path = parsed.path.lstrip('/')
                local_path = os.path.join(script_dir, "public", rel_path)
                if os.path.exists(local_path):
                    img = Image.open(local_path)
                else:
                    req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req) as response:
                        img = Image.open(io.BytesIO(response.read()))
            else:
                req = urllib.request.Request(
                    src, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                )
                with urllib.request.urlopen(req) as response:
                    img = Image.open(io.BytesIO(response.read()))
        elif src.startswith('/') or src.startswith('\\'):
            local_path = os.path.join(script_dir, "public", src.lstrip('/\\'))
            if os.path.exists(local_path):
                img = Image.open(local_path)
            else:
                img = Image.open(src)
        else:
            if not os.path.exists(src):
                pub_path = os.path.join(script_dir, "public", src)
                if os.path.exists(pub_path):
                    src = pub_path
            img = Image.open(src)
            
        img = ImageOps.exif_transpose(img)
        return img.convert('RGB')
    except Exception as e:
        print(json.dumps({"error": f"Failed to load image '{src[:50]}': {str(e)}", "score": 0.0, "verified": False}))
        sys.exit(1)

def yolo_crop_garment(img, yolo_model):
    """Stage 1 & 2: Pass image to Fashion YOLO and crop garment bounding box."""
    if yolo_model is None:
        return img, False
    try:
        results = yolo_model(img, verbose=False)
        if len(results) > 0 and results[0].boxes is not None and len(results[0].boxes) > 0:
            boxes = results[0].boxes
            confidences = boxes.conf
            best_idx = torch.argmax(confidences).item()
            box = boxes.xyxy[best_idx].cpu().numpy()
            x1, y1, x2, y2 = map(int, box)
            
            w, h = img.size
            x1 = max(0, min(x1, w - 1))
            y1 = max(0, min(y1, h - 1))
            x2 = max(x1 + 1, min(x2, w))
            y2 = max(y1 + 1, min(y2, h))
            
            cropped = img.crop((x1, y1, x2, y2))
            return cropped, True
    except Exception as e:
        print(f"YOLO crop warning: {e}", file=sys.stderr)
    return img, False

# -------------------------------------------------------------
# 4. ORB Verification (OpenCV Keypoint & Descriptor Matching)
# -------------------------------------------------------------
def compute_orb_verification(img1_pil, img2_pil):
    """Stage 4: ORB verification - extract keypoints & descriptors to match texture/patterns."""
    try:
        img1 = cv2.cvtColor(np.array(img1_pil), cv2.COLOR_RGB2GRAY)
        img2 = cv2.cvtColor(np.array(img2_pil), cv2.COLOR_RGB2GRAY)

        orb = cv2.ORB_create(nfeatures=500)

        kp1, des1 = orb.detectAndCompute(img1, None)
        kp2, des2 = orb.detectAndCompute(img2, None)

        if des1 is None or des2 is None or len(des1) < 5 or len(des2) < 5:
            return 0.5

        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)

        if not matches:
            return 0.0

        good_matches = [m for m in matches if m.distance < 55.0]
        min_kps = min(len(kp1), len(kp2))
        
        match_ratio = len(good_matches) / max(min_kps, 1)
        orb_score = min(1.0, match_ratio * 2.2)
        return float(orb_score)
    except Exception as e:
        print(f"ORB verification warning: {e}", file=sys.stderr)
        return 0.5

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: verify_clip_service.py <original_src> <uploaded_src>", "score": 0.0, "verified": False}))
        sys.exit(1)
        
    original_src = sys.argv[1]
    uploaded_src = sys.argv[2]
    
    # 1. Load Fashion YOLO model (best.pt)
    yolo_model = None
    if YOLO_AVAILABLE:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        best_pt_path = os.path.join(script_dir, "best.pt")
        if os.path.exists(best_pt_path):
            try:
                yolo_model = YOLO(best_pt_path)
            except Exception as e:
                print(f"Failed to load YOLO model: {e}", file=sys.stderr)
    
    # 3. Load fast OpenCLIP model (ViT-B-32, laion2b_s34b_b79k)
    try:
        model, _, preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32",
            pretrained="laion2b_s34b_b79k"
        )
        model.eval()
    except Exception as e:
        print(json.dumps({"error": f"Failed to load OpenCLIP model: {str(e)}", "score": 0.0, "verified": False}))
        sys.exit(1)
        
    # Load input images
    original_img = load_image(original_src)
    uploaded_img = load_image(uploaded_src)
    
    # STAGE 1 & 2: YOLO Garment Bounding Box Crop
    orig_garment, orig_yolo_cropped = yolo_crop_garment(original_img, yolo_model)
    upl_garment, upl_yolo_cropped = yolo_crop_garment(uploaded_img, yolo_model)
    
    # STAGE 3: CLIP Embeddings & Cosine Similarity
    orig_tensor = preprocess(orig_garment).unsqueeze(0)
    upl_tensor = preprocess(upl_garment).unsqueeze(0)
    
    with torch.no_grad():
        orig_features = model.encode_image(orig_tensor)
        upl_features = model.encode_image(upl_tensor)
        
        orig_features = orig_features / orig_features.norm(dim=-1, keepdim=True)
        upl_features = upl_features / upl_features.norm(dim=-1, keepdim=True)
        
        fashion_clip_sim = F.cosine_similarity(orig_features, upl_features).item()

    # STAGE 4: ORB Feature Verification
    orb_score = compute_orb_verification(orig_garment, upl_garment)
    
    # STAGE 5: Final Score (85% FashionCLIP semantic embedding + 15% ORB feature matching)
    final_score = float(0.85 * fashion_clip_sim + 0.15 * orb_score)
    
    # Threshold calibrated for indoor home camera lighting vs studio catalog photos: >= 0.50
    verified = final_score >= 0.50
    decision = "verified" if final_score >= 0.70 else "verified" if final_score >= 0.50 else "failed"
    
    print(json.dumps({
        "score": final_score,
        "fashion_clip_score": fashion_clip_sim,
        "orb_score": orb_score,
        "verified": verified,
        "decision": decision,
        "yolo_cropped": orig_yolo_cropped and upl_yolo_cropped
    }))

if __name__ == "__main__":
    main()
