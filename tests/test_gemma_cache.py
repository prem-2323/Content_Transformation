import asyncio

from PIL import Image

from visual import gemma_model as gemma_module
from multimodal import service as multimodal_service


class _FakeResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {
            "message": {
                "content": '{"description":"A green square","objects":["square"],"visible_text":[],"important_details":[]}'
            }
        }


class _FakeAsyncClient:
    calls = 0

    def __init__(self, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        return None

    async def post(self, url, json):
        _FakeAsyncClient.calls += 1
        return _FakeResponse()


def test_image_analysis_cache(monkeypatch):
    async def run_test():
        gemma_module.IMAGE_ANALYSIS_CACHE.clear()
        gemma_module._image_cache_locks.clear()
        _FakeAsyncClient.calls = 0
        monkeypatch.setattr(gemma_module.httpx, "AsyncClient", _FakeAsyncClient)

        model = gemma_module.GemmaModel()
        image = Image.new("RGB", (8, 8), "green")

        first_result = await model.analyze_image(image, "Summarize this image", "summary")
        second_result = await model.analyze_image(image.copy(), "Summarize this image", "summary")

        assert first_result == second_result
        assert _FakeAsyncClient.calls == 1

    asyncio.run(run_test())


def test_gemma_model_reuses_and_closes_http_client():
    model = gemma_module.GemmaModel()
    first_client = model._get_http_client()
    second_client = model._get_http_client()

    assert first_client is second_client
    asyncio.run(model.close())
    assert model._http_client is None


def test_duplicate_images_in_parallel_use_one_gemma_request(monkeypatch):
    async def run_test():
        gemma_module.IMAGE_ANALYSIS_CACHE.clear()
        gemma_module._image_cache_locks.clear()
        _FakeAsyncClient.calls = 0
        monkeypatch.setattr(gemma_module.httpx, "AsyncClient", _FakeAsyncClient)

        image = Image.new("RGB", (8, 8), "blue")
        results = await asyncio.gather(
            multimodal_service._analyze_image_with_limit(1, image),
            multimodal_service._analyze_image_with_limit(2, image.copy()),
        )

        assert [result["image_index"] for result in results] == [1, 2]
        assert results[0]["analysis"] == results[1]["analysis"]
        assert _FakeAsyncClient.calls == 1

    asyncio.run(run_test())
