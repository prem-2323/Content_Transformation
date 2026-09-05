import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from video.planner import (
    determine_scene_count,
    calculate_scene_durations,
    estimate_narration_duration,
    calculate_max_word_budget,
    seconds_to_srt_timestamp,
    IntelligentVideoPlanner
)
from video.schemas import VideoPlanRequest, IntelligentVideoPlan
from consistency.schemas import UCKR, DocumentMetadata, FactItem, OutputGenerationConfig
from consistency.generators import VideoGenerator

client = TestClient(app)


def test_determine_scene_count():
    # 30s video in balanced pacing (5s/scene) -> 6 scenes
    assert determine_scene_count(30, "balanced") == 6
    # 15s video -> 3 scenes
    assert determine_scene_count(15, "balanced") == 3
    # 60s video -> 12 scenes
    assert determine_scene_count(60, "balanced") == 12

    # Fast pacing (~3.75s/scene)
    assert determine_scene_count(30, "fast") == 8
    # Cinematic pacing (~6s/scene)
    assert determine_scene_count(30, "cinematic") == 5


def test_calculate_scene_durations():
    # 30s video -> 6 scenes -> 5s each
    durations = calculate_scene_durations(30.0, 6)
    assert len(durations) == 6
    assert sum(durations) == 30.0
    for d in durations:
        assert d == 5.0

    # With importance weights
    weights = [0.8, 0.95, 0.9, 0.7, 0.85, 0.75]
    weighted_durations = calculate_scene_durations(30.0, 6, weights)
    assert len(weighted_durations) == 6
    assert round(sum(weighted_durations), 2) == 30.0
    # Higher weighted scene (0.95) should receive more time than lower weighted (0.7)
    assert weighted_durations[1] >= weighted_durations[3]


def test_narration_budget_and_estimation():
    # 5s scene at 2.5 words/sec -> 12 words max
    max_words = calculate_max_word_budget(5.0)
    assert max_words == 12

    narration = "Artificial intelligence is quietly transforming smart city management and traffic efficiency."
    # 11 words / 2.5 words per sec = 4.4 seconds
    duration_est = estimate_narration_duration(narration)
    assert duration_est == 4.4


def test_seconds_to_srt_timestamp():
    assert seconds_to_srt_timestamp(0.0) == "00:00:00,000"
    assert seconds_to_srt_timestamp(5.0) == "00:00:05,000"
    assert seconds_to_srt_timestamp(12.5) == "00:00:12,500"
    assert seconds_to_srt_timestamp(65.123) == "00:01:05,123"


def test_intelligent_video_planner_plan_from_text():
    sample_text = (
        "Artificial intelligence is transforming modern smart cities. "
        "Intelligent signal synchronization reduced traffic congestion delays by 35%. "
        "City operations deployed IoT sensors across 12 major corridors. "
        "The project was completed within budget in 2025."
    )

    plan = IntelligentVideoPlanner.plan_video(
        content=sample_text,
        target_duration=30,
        pacing="balanced",
        language="English",
        tone="Professional"
    )

    assert plan.target_duration == 30.0
    assert plan.num_scenes == 6
    assert plan.total_calculated_duration == 30.0
    assert len(plan.scenes) == 6

    # Verify transition and subtitle continuity
    for idx, scene in enumerate(plan.scenes):
        assert scene.scene_number == idx + 1
        assert scene.duration > 0
        assert scene.visual_importance >= 0.5
        assert scene.visual_tier in ["HIGH", "MEDIUM", "LOW"]
        assert len(scene.visual_prompt) > 10
        assert scene.start_time < scene.end_time
        assert scene.subtitle_start.startswith("00:")
        assert scene.subtitle_end.startswith("00:")
        if idx > 0:
            # Check chronological continuity
            assert plan.scenes[idx].start_time == plan.scenes[idx - 1].end_time

    # Verify FFmpeg sync metadata
    assert plan.ffmpeg_sync_metadata["target_duration_seconds"] == 30.0
    assert plan.ffmpeg_sync_metadata["scene_count"] == 6
    assert len(plan.ffmpeg_sync_metadata["scene_sync_durations"]) == 6


def test_video_plan_api_endpoint():
    payload = {
        "text": "Autonomous drone networks deliver emergency medical supplies within 8 minutes across rural regions.",
        "target_duration": 30,
        "pacing": "balanced",
        "language": "English"
    }

    response = client.post("/video/plan", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["target_duration"] == 30.0
    assert data["num_scenes"] == 6
    assert len(data["scenes"]) == 6
    assert data["scenes"][0]["subtitle_start"] == "00:00:00,000"


def test_consistency_video_generator_with_intelligent_planning():
    uckr = UCKR(
        document=DocumentMetadata(id="SRC-VID-001", title="Autonomous AI Systems"),
        core_topic="Autonomous Traffic AI",
        summary="AI systems optimize traffic light control reducing congestion by 35%.",
        facts=[
            FactItem(id="F001", statement="AI algorithms reduced peak congestion delays by 35%.", importance=0.95),
            FactItem(id="F002", statement="Deployed IoT sensor network across 12 urban corridors.", importance=0.90),
            FactItem(id="F003", statement="Emergency vehicle response times dropped by 4 minutes.", importance=0.85)
        ]
    )

    config = OutputGenerationConfig(
        output_types=["video"],
        video_duration=30
    )

    video_result = VideoGenerator.generate(uckr, config)
    assert video_result.total_duration_seconds == 30
    assert len(video_result.storyboard) == 6
    assert video_result.storyboard[0].duration_seconds == 5
    assert video_result.storyboard[0].visual_importance >= 0.8
    assert video_result.storyboard[0].transition_type == "crossfade"
    assert video_result.storyboard[0].subtitle_start == "00:00:00,000"
    assert video_result.storyboard[0].subtitle_end == "00:00:05,000"
    assert len(video_result.timeline) == 6
    assert video_result.ffmpeg_sync_metadata["sync_status"] == "synchronized"
