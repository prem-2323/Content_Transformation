# Gen AI Platform for Automated Content Transformation

An intelligent, multi-modal AI platform designed to transform raw source content (text, PDF, DOCX documents, images) into tailored communication deliverables including **LinkedIn Posts, X/Twitter Threads, Executive Summaries, Advisories, Presentations, and Video Scripts**, alongside **Visual Understanding (OCR, Object Detection, Scene Description)**.

---

## 👥 Team Roles & Pipeline Split

| Team Member | Role | AI Model | Pipeline Focus |
|---|---|---|---|
| **Member 1 (Dhanushiyaa)** | Text Processing & Content Transformation Developer | **Qwen3 4B** + FastAPI | Direct text input, TXT/PDF/DOCX extraction, content transformation (LinkedIn, Twitter/X, Summary, Advisory, Presentation, Video Script). |
| **Member 2 (Prem)** | Visual Processing & Image Understanding Developer | **Gemma 3 4B** + FastAPI | Image upload, preprocessing, visual understanding, object/scene identification, OCR text extraction, visual summaries. |

---

## 🏗 System Architecture

```
                                ┌───────────────────────────────────────────────┐
                                │          FastAPI Unified Backend              │
                                │                 (main.py)                     │
                                └───────────────────────┬───────────────────────┘
                                                        │
                         ┌──────────────────────────────┴──────────────────────────────┐
                         │                                                             │
                         ▼                                                             ▼
           Text Transformation Routes                                       Visual Analysis Routes
           (/transform, /transform-file)                                        (/visual/analyze)
                         │                                                             │
                         ▼                                                             ▼
            Text Extraction Subsystem                                     Image Preprocessing Subsystem
            (TXT / PDF / DOCX Extractor)                                      (Format Validation & RGB)
                         │                                                             │
                         ▼                                                             ▼
             Ollama Qwen3 4B Service                                      Ollama Gemma 3 4B Service
             (http://localhost:11434)                                     (http://localhost:11434)
                         │                                                             │
                         └──────────────────────────────┬──────────────────────────────┘
                                                        │
                                                        ▼
                                           Unified Transformation Output
```

---

## 📁 Repository Structure

```
Content Transformation/
│
├── main.py                         # Unified FastAPI application entry point
│
├── text/                           # Member 1 - Text Processing Subsystem
│   ├── __init__.py
│   ├── qwen_service.py             # Ollama API client for Qwen3 4B
│   ├── document_extractor.py       # TXT, PDF, DOCX text extraction
│   ├── schemas.py                  # Pydantic request & response models
│   └── routes.py                   # /transform and /transform-file endpoints
│
├── visual/                         # Member 2 - Visual Processing Subsystem
│   ├── __init__.py
│   ├── gemma_model.py              # Ollama API client for Gemma 3 4B
│   ├── image_processor.py          # PIL image validation & conversion
│   ├── schemas.py                  # Pydantic request & response models
│   └── routes.py                   # /visual/analyze endpoint
│
├── requirements.txt                # Consolidated Python dependencies
└── README.md                       # Project documentation
```

---

## 🚀 Setup & Quickstart Guide

### Prerequisites
1. **Python 3.10+** installed.
2. **Ollama** installed and running on your system (`http://localhost:11434`).

### Step 1: Pull Required Models in Ollama
Make sure both local models are pulled in Ollama:
```bash
# Pull Qwen3 4B model for text transformation
ollama pull qwen3:4b

# Pull Gemma 3 4B model for visual analysis
ollama pull gemma3:4b
```

### Step 2: Install Python Dependencies
Navigate to the `Content Transformation` directory:
```bash
pip install -r requirements.txt
```

### Step 3: Run the FastAPI Server
Start the server using `uvicorn`:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Once running, access interactive API documentation at:
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc API Docs**: `http://localhost:8000/redoc`

---

## 📡 API Endpoints Reference

### 1. Direct Text Transformation (`POST /transform`)
Transforms raw text content into selected deliverable.

**Request Body (`JSON`):**
```json
{
  "text": "Artificial Intelligence is rapidly evolving, impacting healthcare, finance, and software development.",
  "output_type": "linkedin",
  "audience": "Tech Professionals",
  "tone": "Professional",
  "language": "English",
  "detail_level": "Medium",
  "objective": "Inform"
}
```
**Supported `output_type` values**: `linkedin`, `twitter`, `summary`, `advisory`, `presentation`, `video_script`.

---

### 2. Document File Transformation (`POST /transform-file`)
Extracts text from `.txt`, `.pdf`, or `.docx` files and transforms it into the requested format.

**Form Data:**
- `file`: Uploaded file (`.txt`, `.pdf`, `.docx`)
- `output_type`: e.g. `summary`, `presentation`, `linkedin`, `advisory`, `video_script`
- `audience`, `tone`, `language`, `detail_level`, `objective`

---

### 3. Visual Analysis (`POST /visual/analyze`)
Analyzes uploaded images (`.jpg`, `.jpeg`, `.png`) using Gemma 3 4B.

**Form Data:**
- `image`: Image file
- `task`: One of `description`, `ocr`, `objects`, `summary`
- `prompt`: Additional prompt or guidance

**Sample Response (`JSON`):**
```json
{
  "status": "success",
  "message": "Image analyzed successfully.",
  "result": {
    "description": "A financial report dashboard with sales charts and key performance metrics.",
    "objects": ["bar chart", "line graph", "data table"],
    "visible_text": ["Q3 Revenue Report", "Total Sales: $450,000"],
    "important_details": ["Sales increased by 15% in Q3"]
  }
}
```

---

## 🛡 License & Acknowledgments
Built for the Gen AI Automated Content Transformation Hackathon.
