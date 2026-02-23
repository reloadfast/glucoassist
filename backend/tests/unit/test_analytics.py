import pytest

from app.services.analytics import HIGH_MG_DL, LOW_MG_DL, compute_window_stats


@pytest.mark.unit
def test_empty_window():
    stats = compute_window_stats([], 30)
    assert stats.reading_count == 0
    assert stats.avg_glucose is None
    assert stats.hba1c is None
    assert stats.tir_pct is None


@pytest.mark.unit
def test_single_value_no_sd():
    stats = compute_window_stats([120], 30)
    assert stats.reading_count == 1
    assert stats.avg_glucose == 120.0
    assert stats.sd is None
    assert stats.cv_pct is None


@pytest.mark.unit
def test_all_in_range():
    values = [100] * 10
    stats = compute_window_stats(values, 30)
    assert stats.tir_pct == 100.0
    assert stats.tbr_pct == 0.0
    assert stats.tar_pct == 0.0


@pytest.mark.unit
def test_all_below_range():
    values = [50] * 10
    stats = compute_window_stats(values, 30)
    assert stats.tbr_pct == 100.0
    assert stats.tir_pct == 0.0
    assert stats.tar_pct == 0.0


@pytest.mark.unit
def test_all_above_range():
    values = [250] * 10
    stats = compute_window_stats(values, 30)
    assert stats.tar_pct == 100.0
    assert stats.tir_pct == 0.0
    assert stats.tbr_pct == 0.0


@pytest.mark.unit
def test_mixed_tir():
    # 5 in-range (100), 3 below (50), 2 above (200)
    values = [100] * 5 + [50] * 3 + [200] * 2
    stats = compute_window_stats(values, 30)
    assert stats.tir_pct == 50.0
    assert stats.tbr_pct == 30.0
    assert stats.tar_pct == 20.0


@pytest.mark.unit
def test_hba1c_formula():
    # eAG = 154 → HbA1c = (154 + 46.7) / 28.7 ≈ 6.99 → 7.0
    values = [154] * 10
    stats = compute_window_stats(values, 30)
    assert stats.eag == 154.0
    assert stats.hba1c == pytest.approx(7.0, abs=0.1)


@pytest.mark.unit
def test_cv_computed():
    values = [80, 100, 120, 140, 160]
    stats = compute_window_stats(values, 30)
    assert stats.sd is not None
    assert stats.cv_pct is not None
    assert stats.cv_pct > 0


@pytest.mark.unit
def test_threshold_boundary_values():
    # Exact boundary values should be in-range
    values = [LOW_MG_DL, HIGH_MG_DL]
    stats = compute_window_stats(values, 30)
    assert stats.tir_pct == 100.0


@pytest.mark.unit
def test_window_days_preserved():
    stats = compute_window_stats([100], 60)
    assert stats.window_days == 60
