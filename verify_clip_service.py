import sys
import json
import urllib.request
import io
from PIL import Image
import open_clip
import torch
import torch.nn.functional as F

def load_image(src):
    try:
        if src.startswith('http://') or src.startswith('https://'):
            req = urllib.request.Request(
                src, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req) as response:
                return Image.open(io.BytesIO(response.read())).convert('RGB')
        else:
            return Image.open(src).convert('RGB')
    except Exception as e:
        print(json.dumps({"error": f"Failed to load image {src}: {str(e)}", "score": 0.0, "verified": False}))
        sys.exit(1)

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: verify_clip_service.py <original_src> <uploaded_src>", "score": 0.0, "verified": False}))
        sys.exit(1)
        
    original_src = sys.argv[1]
    uploaded_src = sys.argv[2]
    
    # Load model
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
    
    # Preprocess
    original_tensor = preprocess(original_img).unsqueeze(0)
    uploaded_tensor = preprocess(uploaded_img).unsqueeze(0)
    
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
