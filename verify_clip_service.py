import os
import sys
import warnings
import logging

# Configure standard logging to output exclusively to stderr
logging.basicConfig(
    level=logging.INFO,
    stream=sys.stderr,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("verification_service")

# Silence all standard warnings
warnings.filterwarnings("ignore")

# Suppress Hugging Face, Torch and OpenMP environment warnings
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

# Back up original stdout to preserve it for the final JSON CLI output
original_stdout = sys.stdout
# Redirect standard sys.stdout to sys.stderr to capture any unpreventable library stdout print pollution
sys.stdout = sys.stderr

import json
import urllib.request
import urllib.parse
import io
import base64
import argparse
import http.server
import socketserver
import numpy as np
import cv2
from PIL import Image, ImageOps
import torch
import torch.nn.functional as F

# -------------------------------------------------------------
# 1. Model Preloading Setup
# -------------------------------------------------------------
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

# Global pre-loaded model instances
yolo_model = None
dinov2_processor = None
dinov2_model = None
rembg_session = None
ocr_reader = None

def preload_models():
    """Load neural network models once to achieve fast subsequent inferences."""
    global yolo_model, dinov2_processor, dinov2_model, rembg_session, ocr_reader
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    best_pt_path = os.path.join(script_dir, "best.pt")
    
    # 1. Load YOLO
    if YOLO_AVAILABLE:
        try:
            if os.path.exists(best_pt_path):
                yolo_model = YOLO(best_pt_path)
                logger.info("YOLO model loaded with custom best.pt weights.")
            else:
                logger.info("best.pt not found, falling back to pre-trained yolov8n.pt...")
                yolo_model = YOLO("yolov8n.pt")
                logger.info("YOLO model loaded with pre-trained yolov8n.pt weights.")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            
    # 2. Load rembg
    try:
        from rembg import new_session
        rembg_session = new_session()
        logger.info("rembg background remover session created.")
    except Exception as e:
        logger.error(f"Failed to load rembg session: {e}")

    # 3. Load DINOv2
    try:
        from transformers import AutoProcessor, Dinov2Model
        dinov2_processor = AutoProcessor.from_pretrained("facebook/dinov2-small")
        dinov2_model = Dinov2Model.from_pretrained("facebook/dinov2-small")
        dinov2_model.eval()
        logger.info("DINOv2 model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load DINOv2 model: {e}")

    # 4. Load EasyOCR
    try:
        import easyocr
        ocr_reader = easyocr.Reader(['en'], gpu=False)
        logger.info("EasyOCR Reader loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load EasyOCR: {e}")


# Helper to load PIL image from local path, URL or base64 data
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
                    headers={'User-Agent': 'Mozilla/5.0'}
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
        raise RuntimeError(f"Failed to load image: {str(e)}")


# -------------------------------------------------------------
# PIPELINE STAGES
# -------------------------------------------------------------

def stage1_yolo_crop(img, model):
    """Stage 1: Detect garment and crop highest confidence bounding box."""
    if model is None:
        return img, False
    try:
        results = model(img, verbose=False)
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
        logger.error(f"YOLO crop warning: {e}")
    return img, False


def stage2_remove_background(img, session):
    """Stage 2: Remove the background and replace with white background."""
    if session is None:
        return img, False
    try:
        from rembg import remove
        rgba_img = remove(img, session=session)
        
        # Composite alpha onto a solid white background
        white_bg = Image.new("RGBA", rgba_img.size, (255, 255, 255, 255))
        comp_img = Image.alpha_composite(white_bg, rgba_img)
        return comp_img.convert("RGB"), True
    except Exception as e:
        logger.error(f"Background removal warning: {e}")
        return img, False


def stage3_dinov2_embeddings(img1, img2, processor, model):
    """Stage 3: Generate visual embeddings via DINOv2 and compute cosine similarity."""
    if processor is None or model is None:
        return 0.5
    try:
        inputs1 = processor(images=img1, return_tensors="pt")
        inputs2 = processor(images=img2, return_tensors="pt")
        
        with torch.no_grad():
            outputs1 = model(**inputs1)
            outputs2 = model(**inputs2)
            
            # [CLS] token embedding (first token index)
            emb1 = outputs1.last_hidden_state[:, 0, :]
            emb2 = outputs2.last_hidden_state[:, 0, :]
            
            emb1 = emb1 / emb1.norm(dim=-1, keepdim=True)
            emb2 = emb2 / emb2.norm(dim=-1, keepdim=True)
            
            sim = F.cosine_similarity(emb1, emb2).item()
            return float(sim)
    except Exception as e:
        logger.error(f"DINOv2 similarity warning: {e}")
        return 0.5


def stage4_color_verification(img1, img2):
    """Stage 4: Convert to HSV and compare color correlation histograms."""
    try:
        # Convert PIL to openCV style HSV
        hsv1 = cv2.cvtColor(np.array(img1), cv2.COLOR_RGB2HSV)
        hsv2 = cv2.cvtColor(np.array(img2), cv2.COLOR_RGB2HSV)
        
        # Compute 2D Hue-Saturation histogram
        hist1 = cv2.calcHist([hsv1], [0, 1], None, [50, 60], [0, 180, 0, 256])
        hist2 = cv2.calcHist([hsv2], [0, 1], None, [50, 60], [0, 180, 0, 256])
        
        # Normalize
        cv2.normalize(hist1, hist1, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        cv2.normalize(hist2, hist2, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        
        # Correlate histograms
        corr = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
        
        # Map correlation score [-1.0, 1.0] to [0.0, 1.0]
        score = max(0.0, (corr + 1.0) / 2.0)
        return float(score)
    except Exception as e:
        logger.error(f"Color verification warning: {e}")
        return 0.5


def stage5_ocr_brand_verification(img_upl, target_brand, reader):
    """Stage 5: Detect text and inspect for brand matches or conflicts."""
    if reader is None or not target_brand:
        return 0.0  # Ignore (neutral)
    try:
        target_clean = target_brand.strip().lower()
        
        # Perform OCR on uploaded image
        results = reader.readtext(np.array(img_upl))
        detected_words = [r[1].lower() for r in results]
        
        # Match check
        matched = any(target_clean in word for word in detected_words)
        
        # Conflict check with other major brands
        major_brands = ["nike", "adidas", "puma", "reebok", "roadster", "hrx", "zara", "h&m", "levis"]
        conflict = False
        for mb in major_brands:
            if mb != target_clean:
                if any(mb in word for word in detected_words):
                    conflict = True
                    break
                    
        if matched:
            return 1.0  # Boost
        elif conflict:
            return -1.0  # Penalty
        else:
            return 0.0  # Neutral
    except Exception as e:
        logger.error(f"OCR tag verification warning: {e}")
        return 0.0


def run_pipeline(original_src, uploaded_src, target_brand=""):
    """Core verification pipeline coordinating stages 1 to 6."""
    try:
        # 0. Load images
        try:
            original_img = load_image(original_src)
            uploaded_img = load_image(uploaded_src)
        except Exception as e:
            return {
                "verified": False,
                "decision": "failed",
                "embedding_score": 0.0,
                "color_score": 0.0,
                "brand_score": 0.0,
                "final_score": 0.0,
                "error": f"Failed to load images: {str(e)}"
            }
        
        # Stage 1: YOLO Crop
        try:
            orig_cropped, orig_yolo_success = stage1_yolo_crop(original_img, yolo_model)
            upl_cropped, upl_yolo_success = stage1_yolo_crop(uploaded_img, yolo_model)
            yolo_success = orig_yolo_success and upl_yolo_success
        except Exception as e:
            logger.error(f"YOLO crop failure: {e}")
            orig_cropped, upl_cropped = original_img, uploaded_img
            yolo_success = False
            
        # Stage 2: Background Removal
        try:
            orig_clean, _ = stage2_remove_background(orig_cropped, rembg_session)
            upl_clean, _ = stage2_remove_background(upl_cropped, rembg_session)
        except Exception as e:
            logger.error(f"Background removal failure: {e}")
            orig_clean, upl_clean = orig_cropped, upl_cropped
            
        # Stage 3: DINOv2 Visual Embeddings
        try:
            embedding_score = stage3_dinov2_embeddings(orig_clean, upl_clean, dinov2_processor, dinov2_model)
        except Exception as e:
            logger.error(f"DINOv2 embedding failure: {e}")
            embedding_score = 0.5
            
        # Stage 4: Color Verification (HSV correlation)
        try:
            color_score = stage4_color_verification(orig_clean, upl_clean)
        except Exception as e:
            logger.error(f"Color verification failure: {e}")
            color_score = 0.5
            
        # Stage 5: OCR Brand Verification
        try:
            brand_score = stage5_ocr_brand_verification(upl_cropped, target_brand, ocr_reader)
        except Exception as e:
            logger.error(f"OCR verification failure: {e}")
            brand_score = 0.0
            
        # Stage 6: Weighted Final Confidence
        # If no OCR tag was detected (neutral 0.0), distribute weight between DINOv2 and Color (75:20 ratio)
        if brand_score == 0.0:
            base_score = float(0.75 * embedding_score + 0.20 * color_score) / 0.95
            final_score = base_score
        else:
            final_score = float(0.75 * embedding_score + 0.20 * color_score + 0.05 * brand_score)
            
        final_score = max(0.0, min(1.0, final_score))
        
        # Make decision labels
        if final_score >= 0.75:
            verified = True
            decision = "verified"
        elif final_score >= 0.50:
            verified = True
            decision = "manual_review"
        else:
            verified = False
            decision = "failed"
            
        return {
            "verified": verified,
            "decision": decision,
            "embedding_score": embedding_score,
            "color_score": color_score,
            "brand_score": brand_score,
            "final_score": final_score,
            "error": None
        }
    except Exception as e:
        logger.error(f"General pipeline execution error: {e}")
        return {
            "verified": False,
            "decision": "failed",
            "embedding_score": 0.0,
            "color_score": 0.0,
            "brand_score": 0.0,
            "final_score": 0.0,
            "error": f"General pipeline error: {str(e)}"
        }


# -------------------------------------------------------------
# HTTP SERVER IMPLEMENTATION
# -------------------------------------------------------------

class VerificationHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress logging message spam to keep console clean
        pass

    def do_POST(self):
        if self.path == '/verify':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                req_data = json.loads(post_data.decode('utf-8'))
                
                # Support both new/requested and legacy format body keys
                original_src = req_data.get('original_image') or req_data.get('original_src')
                uploaded_src = req_data.get('uploaded_image') or req_data.get('uploaded_src')
                brand_name = req_data.get('brand', '')
                
                if not original_src or not uploaded_src:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "verified": False,
                        "decision": "failed",
                        "embedding_score": 0.0,
                        "color_score": 0.0,
                        "brand_score": 0.0,
                        "final_score": 0.0,
                        "error": "Missing original_image or uploaded_image in payload"
                    }).encode('utf-8'))
                    return
                
                result = run_pipeline(original_src, uploaded_src, brand_name)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                logger.error(f"Daemon HTTP verify error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "verified": False,
                    "decision": "failed",
                    "embedding_score": 0.0,
                    "color_score": 0.0,
                    "brand_score": 0.0,
                    "final_score": 0.0,
                    "error": f"Internal daemon error: {str(e)}"
                }).encode('utf-8'))
        elif self.path == '/ping':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("original", nargs="?", default=None, help="Original catalog image source")
    parser.add_argument("uploaded", nargs="?", default=None, help="Uploaded seller image source")
    parser.add_argument("--brand", default="", help="Garment brand to check tags for")
    parser.add_argument("--server", action="store_true", help="Launch persistent HTTP daemon server")
    parser.add_argument("--port", type=int, default=8001, help="Port to run the server on")
    args = parser.parse_args()

    # Preload models
    preload_models()

    if args.server:
        server = socketserver.TCPServer(("localhost", args.port), VerificationHandler)
        logger.info(f"Robust Fashion Verification Daemon running on http://localhost:{args.port}")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            logger.info("Shutting down server.")
            server.server_close()
    else:
        if not args.original or not args.uploaded:
            print(json.dumps({
                "verified": False,
                "decision": "failed",
                "embedding_score": 0.0,
                "color_score": 0.0,
                "brand_score": 0.0,
                "final_score": 0.0,
                "error": "Usage error: both original and uploaded image paths must be supplied."
            }), file=original_stdout)
            sys.exit(1)
            
        try:
            result = run_pipeline(args.original, args.uploaded, args.brand)
            # Print the clean JSON result strictly to original_stdout
            print(json.dumps(result), file=original_stdout)
        except Exception as e:
            print(json.dumps({
                "verified": False,
                "decision": "failed",
                "embedding_score": 0.0,
                "color_score": 0.0,
                "brand_score": 0.0,
                "final_score": 0.0,
                "error": f"CLI execution error: {str(e)}"
            }), file=original_stdout)
            sys.exit(1)


if __name__ == "__main__":
    main()
