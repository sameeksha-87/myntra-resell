import os
import torch
import open_clip
import torch.nn.functional as F
from PIL import Image
from ultralytics import YOLO

# -----------------------------
# 1. Load Fashion YOLO Model
# -----------------------------
print("📦 Loading Fashion YOLO model (best.pt)...")
yolo_model = YOLO("best.pt")

def crop_clothing(image_path):
    img = Image.open(image_path).convert("RGB")
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
        print(f"✂️ Cropped clothing box {box.tolist()} for {image_path}")
        return cropped
    print(f"⚠️ No clothing detected for {image_path}, using full image.")
    return img

# -----------------------------
# 2. Crop clothing from images
# -----------------------------
original_cropped = crop_clothing("original.jpg")
uploaded_cropped = crop_clothing("uploaded.jpg")

# -----------------------------
# 3. Load OpenCLIP Model
# -----------------------------
print("🧠 Loading OpenCLIP model (ViT-B-32)...")
model, _, preprocess = open_clip.create_model_and_transforms(
    "ViT-B-32",
    pretrained="laion2b_s34b_b79k"
)
model.eval()

# Preprocess cropped images
original_tensor = preprocess(original_cropped).unsqueeze(0)
uploaded_tensor = preprocess(uploaded_cropped).unsqueeze(0)

# -----------------------------
# 4. Generate Embeddings
# -----------------------------
with torch.no_grad():
    original_features = model.encode_image(original_tensor)
    uploaded_features = model.encode_image(uploaded_tensor)

# Normalize embeddings
original_features /= original_features.norm(dim=-1, keepdim=True)
uploaded_features /= uploaded_features.norm(dim=-1, keepdim=True)

# -----------------------------
# 5. Calculate Cosine Similarity
# -----------------------------
similarity = F.cosine_similarity(original_features, uploaded_features)
score = similarity.item()

print(f"\n✨ Similarity Score: {score:.4f}")

# -----------------------------
# 6. Final Decision
# -----------------------------
if score >= 0.75:
    print("✅ Verified: High Confidence Match")
elif score >= 0.60:
    print("✅ Verified: Match (Catalog vs User Real-world Photo)")
else:
    print("❌ Different Product")