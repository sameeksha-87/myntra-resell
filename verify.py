import open_clip
import torch
import torch.nn.functional as F
from PIL import Image

# -----------------------------
# Load OpenCLIP Model
# -----------------------------
model, _, preprocess = open_clip.create_model_and_transforms(
    "ViT-B-32",
    pretrained="laion2b_s34b_b79k"
)

model.eval()

# -----------------------------
# Load Images
# -----------------------------
original = preprocess(Image.open("original.jpg").convert("RGB")).unsqueeze(0)
uploaded = preprocess(Image.open("uploaded.jpg").convert("RGB")).unsqueeze(0)

# -----------------------------
# Generate Embeddings
# -----------------------------
with torch.no_grad():
    original_features = model.encode_image(original)
    uploaded_features = model.encode_image(uploaded)

# Normalize embeddings
original_features /= original_features.norm(dim=-1, keepdim=True)
uploaded_features /= uploaded_features.norm(dim=-1, keepdim=True)

# -----------------------------
# Calculate Cosine Similarity
# -----------------------------
similarity = F.cosine_similarity(
    original_features,
    uploaded_features
)

score = similarity.item()

print(f"Similarity Score: {score:.4f}")

# -----------------------------
# Decision
# -----------------------------
if score >= 0.90:
    print("✅ Verified: Same Product")
elif score >= 0.75:
    print("🟡 Manual Review Required")
else:
    print("❌ Different Product")