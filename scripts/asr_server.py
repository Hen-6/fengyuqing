import os
import sys
import argparse
import tempfile
import torch

try:
    from fastapi import FastAPI, UploadFile, File
    from fastapi.middleware.cors import CORSMiddleware
    from funasr import AutoModel
    import uvicorn
except ImportError:
    print("Error: Missing required Python packages.")
    print("Please install them using: pip install fastapi uvicorn funasr modelscope torch torchaudio sentencepiece")
    sys.exit(1)

app = FastAPI(title="Fengyuqing Local ASR Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Detect and select device (MPS for Apple Silicon, CUDA for Nvidia GPU, or CPU)
if torch.backends.mps.is_available():
    device = "mps"
    print("Using device: Apple Silicon (MPS)")
elif torch.cuda.is_available():
    device = "cuda"
    print("Using device: CUDA GPU")
else:
    device = "cpu"
    print("Using device: CPU")

print("Loading SenseVoice-Small model... (This may take a minute on first run to download model)")
try:
    model = AutoModel(
        model="iic/SenseVoiceSmall",
        device=device,
        disable_update=True
    )
    print("Model loaded successfully!")
except Exception as e:
    print(f"Failed to load model on {device}: {e}. Retrying on CPU...")
    try:
        model = AutoModel(
            model="iic/SenseVoiceSmall",
            device="cpu",
            disable_update=True
        )
        print("Model loaded successfully on CPU!")
    except Exception as ex:
        print(f"Error: Failed to load model on CPU: {ex}")
        sys.exit(1)

@app.get("/api/asr")
async def health_check():
    return {"status": "online"}

@app.post("/api/asr")
async def transcribe(file: UploadFile = File(...)):
    # Create a temporary file to save the uploaded audio
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        # Run inference using SenseVoiceSmall
        res = model.generate(
            input=temp_path,
            cache={},
            language="auto",
            use_itn=True,
            batch_size_s=60,
        )
        
        text_result = ""
        if res and len(res) > 0 and "text" in res[0]:
            text = res[0]["text"]
            # SenseVoice returns tags like <|zh|><|NEUTRAL|><|Speech|> text
            # Remove XML/HTML style tags using regex
            import re
            text_result = re.sub(r"<\|.*?\|>", "", text).strip()
            
        print(f"Processed transcription: {text_result}")
        return {"text": text_result}

    except Exception as e:
        print(f"Error during transcription: {e}")
        return {"error": str(e), "text": ""}
    
    finally:
        # Ensure cleanup of temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start Fengyuqing Local ASR Server")
    parser.add_argument("--port", type=int, default=8000, help="Port to run the server on")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host address to run the server on")
    args = parser.parse_args()
    
    uvicorn.run(app, host=args.host, port=args.port)
