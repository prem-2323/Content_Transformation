# Gen AI Content Transformation Platform

A FastAPI platform for transforming text and documents into communication content, analyzing uploaded images, generating images from prompts, generating scene images from content, creating presentations, and producing audio narration.

## AI Services

- Qwen3 4B through Ollama: text transformation and image prompt engineering.
- Gemma 3 4B through Ollama: visual analysis.
- Stable Diffusion 1.5 through WebUI Forge: image generation.
- edge-tts: MP3 narration.

## Architecture

```text
FastAPI (main.py)
|
+- Text routes: /transform, /transform-file
|  +- TXT/PDF/DOCX extraction
|  +- Ollama Qwen3 4B
|  `- Text, PPTX, and video-script outputs
|
+- Visual routes: /visual/analyze
|  +- PIL validation and RGB conversion
|  `- Ollama Gemma3 4B
|
`- Image routes: /generate-image, /generate-scene-images
   +- Qwen scene prompt engineering
   +- Stable Diffusion WebUI Forge API
   `- PNG validation and generated_images/ storage
```

Image generation supports two modes:

1. Direct generation: user prompt -> Stable Diffusion -> PNG.
2. Content to images: source text or video script -> Qwen scene prompts -> one PNG per scene.

## Repository Layout

```text
Content Transformation/
|- main.py                         FastAPI application and router registration
|- requirements.txt                Application dependencies
|- validation.py                   Output validation and normalization
|- text/                           Text, document, PPTX, and audio services
|- visual/                         Gemma image-analysis service
|- image/                          Stable Diffusion generation service
|- scripts/
|  `- setup_image_backend.ps1      Forge and SD1.5 setup script
|- tests/                          Automated tests
|- generated_audio/                Local MP3 output, ignored by Git
`- generated_images/               Local PNG output, ignored by Git
```

## Prerequisites

- Windows with Python 3.10 or newer.
- Git and curl available on `PATH`.
- Ollama installed for text and visual features.
- An NVIDIA GPU is recommended for local generation. The tested target is an RTX 3050 Laptop GPU with 4 GB VRAM.

## Application Setup

From the project directory:

```powershell
cd "Content Transformation"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Pull the Ollama models:

```powershell
ollama serve
ollama pull qwen3:4b
ollama pull gemma3:4b
```

Start FastAPI:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Documentation and health URLs:

- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/health

Run only one FastAPI process at a time.

## Image Backend Setup

The application expects a Stable Diffusion WebUI-compatible API at:

```text
http://127.0.0.1:7860/sdapi/v1/txt2img
```

The tracked setup script keeps the large Forge checkout, model weights, and virtual environment outside this repository. Run it from `Content Transformation`:

```powershell
.\scripts\setup_image_backend.ps1
```

The script clones or updates Forge beside this project, downloads the SD 1.5 checkpoint with resume support, and creates `start-image-api.bat`. The checkpoint is approximately 4.27 GB.

Start Forge in a second terminal:

```powershell
..\stable-diffusion-webui-forge\start-image-api.bat
```

The launcher uses settings suitable for a 4 GB RTX 3050:

```text
--api --listen --port 7860
--always-offload-from-vram --cuda-malloc --opt-sdp-attention
```

Verify Forge before calling FastAPI:

```powershell
Invoke-WebRequest http://127.0.0.1:7860/sdapi/v1/samplers -UseBasicParsing
```

If the image backend uses another address, set this before starting FastAPI:

```powershell
$env:IMAGE_MODEL_URL = "http://127.0.0.1:7860"
```

## Image API

### Direct image generation

`POST /generate-image` accepts JSON. Defaults are 512x512 and 20 steps for a 4 GB GPU.

Request:

```json
{
  "prompt": "A futuristic smart city using artificial intelligence"
}
```

Optional request fields are `negative_prompt`, `width`, `height`, and `steps`.

Response:

```json
{
  "status": "success",
  "filename": "image_123456789abc.png",
  "image_path": "generated_images/image_123456789abc.png"
}
```

Retrieve the image with `GET /image/{filename}`.

PowerShell example:

```powershell
$body = @{ prompt = "A futuristic smart city using artificial intelligence" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://127.0.0.1:8000/generate-image" -Method Post -ContentType "application/json" -Body $body
```

### Content to scene images

`POST /generate-scene-images` accepts source text or a video-script object. Qwen creates detailed image prompts and Forge renders one PNG per scene.

```json
{
  "script": {
    "video_title": "AI in Healthcare",
    "storyboard": [
      {"scene": 1, "visuals": "Doctors using AI diagnostic tools in a modern hospital"},
      {"scene": 2, "visuals": "Doctors reviewing a glowing medical dashboard"}
    ]
  }
}
```

`POST /generate-scene-images-from-file` accepts a TXT, PDF, or DOCX upload and extracts its text before scene generation.

Image error statuses:

- `503`: Ollama or Stable Diffusion is unavailable.
- `502`: the model returned invalid image data.
- `400`: invalid request or unsupported document type.
- `404`: generated PNG was not found.

## Other Endpoints

Text and documents:

- `POST /transform`: transform direct text.
- `POST /transform-file`: transform TXT, PDF, or DOCX.
- Output types: `linkedin`, `twitter`, `summary`, `advisory`, `presentation`, `video_script`, and `infographic`.

Visual analysis:

- `POST /visual/analyze`: analyze JPG, JPEG, or PNG with Gemma3.
- Form fields: `image`, `task`, and optional `prompt`.
- Tasks: `description`, `ocr`, `objects`, and `summary`.

Presentations:

- `POST /export-pptx`: create a PPTX from JSON text input.
- `POST /export-pptx-file`: create a PPTX from a TXT, PDF, or DOCX upload.

Audio:

- `POST /generate-audio`: convert plain text to MP3.
- `POST /generate-video-audio`: convert a video script to MP3.
- `GET /audio/{filename}`: download generated audio.
- `GET /audio-voices`: list recommended voices.

Service information:

- `GET /`: service summary.
- `GET /health`: health check.
- `GET /models` and `GET /v1/models`: configured model list.

## Testing

Run image endpoint tests without a GPU or external model; model calls are mocked:

```powershell
cd "Content Transformation"
.\.venv\Scripts\python.exe -m pytest tests/test_image_generation.py -q
```

Run the full suite:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Run a live 512x512 image smoke test after FastAPI and Forge are running:

```powershell
$body = @{
  prompt = "A futuristic smart city using artificial intelligence"
  width = 512
  height = 512
  steps = 20
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/generate-image" -Method Post -ContentType "application/json" -Body $body
```

## RTX 3050 4 GB Guidance

- Use 512x512 resolution.
- Use 20 steps as the default.
- Generate one image at a time.
- Keep `--always-offload-from-vram` enabled.
- Increase resolution or steps only after confirming available VRAM.

## Git and Generated Files

The repository tracks source code, tests, documentation, and setup scripts. It ignores runtime outputs and model files, including:

```text
generated_audio/
generated_images/
*.safetensors
venv/
.venv/
```

Do not commit the Forge checkout, virtual environment, model checkpoint, or generated media. The setup script is the reproducible way to install the backend locally.

## Troubleshooting

### Image model unavailable

Check Forge first:

```powershell
Invoke-WebRequest http://127.0.0.1:7860/sdapi/v1/samplers -UseBasicParsing
```

Then check FastAPI:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/health -UseBasicParsing
```

### Forge reports an invalid argument

Use the generated `start-image-api.bat`. Current Forge uses `--listen` as a flag and uses `--always-offload-from-vram` instead of the removed `--medvram`.

### NumPy ABI warning

Forge's compiled dependencies require NumPy 1.x. Repair its environment with:

```powershell
..\stable-diffusion-webui-forge\venv\Scripts\python.exe -m pip install "numpy<2"
```

### GPU memory errors

Keep generation at 512x512 and 20 steps, generate one image at a time, and keep the supplied offload settings enabled.

## License and Acknowledgments

Built for the Gen AI Automated Content Transformation project. Local model licenses and usage terms remain the responsibility of the model and backend distributors.
