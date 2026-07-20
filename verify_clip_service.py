import sys
import json
import urllib.request
import io
import numpy as np
from PIL import Image, ImageOps
import open_clip
import torch
import torch.nn.functional as F
from transformers import SegformerImageProcessor, AutoModelForSemanticSegmentation

# Define SegFormer model globally
device = "cuda" if torch.cuda.is_available() else "cpu"
seg_processor = None
seg_model = None

try:
    # Load lightweight SegFormer clothes segmentation model
    seg_processor = SegformerImageProcessor.from_pretrained("mattmdjaga/segformer_b0_clothes")
    seg_model = AutoModelForSemanticSegmentation.from_pretrained("mattmdjaga/segformer_b0_clothes").to(device)
    seg_model.eval()
except Exception as e:
    # We will log the error but allow the script to proceed using raw images as fallback
    print(f"Warning: SegFormer model loading failed: {e}", file=sys.stderr)

def segment_and_crop_clothing(img: Image.Image) -> Image.Image:
    if seg_model is None or seg_processor is None:
        return img

    try:
        w, h = img.size
        # Run inference
        inputs = seg_processor(images=img, return_tensors="pt").to(device)
        with torch.no_grad():
            outputs = seg_model(**inputs)

        logits = outputs.logits.cpu()
        # Upsample logits to original image size
        upsampled_logits = F.interpolate(
            logits,
            size=(h, w),
            mode="bilinear",
            align_corners=False
        )
        pred_seg = upsampled_logits.argmax(dim=1)[0].numpy()

        # Define clothing category classes:
        # 1: Hat, 3: Glove, 4: Sunglasses, 5: UpperClothes, 6: Dress, 7: Coat, 8: Socks, 9: Pants, 11: Scarf, 12: Skirt, 18: Left-shoe, 19: Right-shoe
        # Excludes: Background (0), Hair (2), Torso-skin (10), Face (13), Arms (14, 15), Legs (16, 17)
        clothing_classes = [1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 18, 19]
        clothing_mask = np.isin(pred_seg, clothing_classes)

        # Enforce minimum clothing coverage (e.g. at least 5% of the image) to avoid cropping to tiny noise pixels
        mask_pixels = np.sum(clothing_mask)
        total_pixels = w * h
        if mask_pixels < (total_pixels * 0.05):
            return img  # Fallback if no substantial clothing is detected

        # Mask out non-clothing background pixels (fill with white, RGB = 255)
        img_np = np.array(img)
        masked_img_np = img_np.copy()
        masked_img_np[~clothing_mask] = 255

        # Bounding box coordinates for cropping
        rows = np.any(clothing_mask, axis=1)
        cols = np.any(clothing_mask, axis=0)
        ymin, ymax = np.where(rows)[0][[0, -1]]
        xmin, xmax = np.where(cols)[0][[0, -1]]

        # Small border padding
        padding = 12
        ymin = max(0, ymin - padding)
        ymax = min(h, ymax + padding)
        xmin = max(0, xmin - padding)
        xmax = min(w, xmax + padding)

        # Crop to the clothing item
        cropped_img = Image.fromarray(masked_img_np).crop((xmin, ymin, xmax, ymax))
        return cropped_img

    except Exception as e:
        print(f"Warning: Clothes segmentation preprocessing failed: {e}", file=sys.stderr)
        return img

def load_image(src):
    try:
        if src.startswith('http://') or src.startswith('https://'):
            req = urllib.request.Request(
                src, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req) as response:
                img = Image.open(io.BytesIO(response.read()))
        else:
            img = Image.open(src)
            
        img = ImageOps.exif_transpose(img)
        return img.convert('RGB')
    except Exception as e:
        print(json.dumps({"error": f"Failed to load image {src}: {str(e)}", "score": 0.0, "verified": False}))
        sys.exit(1)

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: verify_clip_service.py <original_src> <uploaded_src>", "score": 0.0, "verified": False}))
        sys.exit(1)
        
    original_src = sys.argv[1]
    uploaded_src = sys.argv[2]
    
    # Load CLIP model
    try:
        model, _, preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32",
            pretrained="laion2b_s34b_b79k"
        )
        model.eval()
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model: {str(e)}", "score": 0.0, "verified": False}))
        sys.exit(1)
        
    # Load images
    original_img = load_image(original_src)
    uploaded_img = load_image(uploaded_src)
    
    # Run clothing segmentation and cropping
    original_cropped = segment_and_crop_clothing(original_img)
    uploaded_cropped = segment_and_crop_clothing(uploaded_img)
    
    # Preprocess for CLIP
    original_tensor = preprocess(original_cropped).unsqueeze(0)
    uploaded_tensor = preprocess(uploaded_cropped).unsqueeze(0)
    
    # Generate embeddings
    with torch.no_grad():
        original_features = model.encode_image(original_tensor)
        uploaded_features = model.encode_image(uploaded_tensor)
        
    # Normalize
    original_features /= original_features.norm(dim=-1, keepdim=True)
    uploaded_features /= uploaded_features.norm(dim=-1, keepdim=True)
    
    # Calculate similarity
    similarity = F.cosine_similarity(original_features, uploaded_features)
    score = float(similarity.item())
    
    # Decision matching verify.py logic:
    # >= 0.90 => Verified: Same Product
    # >= 0.75 => Manual Review Required
    # < 0.75 => Different Product
    decision = "verified" if score >= 0.90 else "review" if score >= 0.75 else "failed"
    verified = score >= 0.75
    
    print(json.dumps({
        "score": score,
        "verified": verified,
        "decision": decision
    }))

if __name__ == "__main__":
    main()
