import requests


OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen3:4b"
REQUEST_TIMEOUT_SECONDS = 120


class QwenServiceError(Exception):
    """Raised when Ollama cannot complete a generation request."""


def generate_with_qwen(prompt: str) -> str:
    """Send generation prompt to local Ollama Qwen3 4B model."""
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "options": {
            "num_predict": 200
        }
    }

    try:
        response = requests.post(
            OLLAMA_URL,
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS
        )
        response.raise_for_status()
    except requests.exceptions.Timeout as error:
        raise QwenServiceError(
            "Ollama took too long to generate the transformation."
        ) from error
    except requests.exceptions.RequestException as error:
        raise QwenServiceError(
            "Ollama could not process the transformation request."
        ) from error

    data = response.json()
    return data.get("response", "")
