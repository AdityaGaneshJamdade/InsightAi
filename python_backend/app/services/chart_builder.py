from __future__ import annotations

from typing import Any

from app.schemas import ChartSpec


def build_chart_spec(
    data: list[dict[str, Any]],
    title: str,
    x_axis: str | None,
    y_axis: str | None,
    intent: str,
) -> ChartSpec | None:
    if not data:
        return None

    numeric_fields = [
        key for key in data[0]
        if any(isinstance(row.get(key), (int, float)) and not isinstance(row.get(key), bool) for row in data)
    ]
    if not numeric_fields:
        return None
    selected_y = y_axis if y_axis in numeric_fields else numeric_fields[0]
    selected_x = x_axis if x_axis in data[0] else next((key for key in data[0] if key != selected_y), None)
    if not selected_x:
        return ChartSpec(type="kpi", title=title, y_axis=selected_y, data=data)

    if intent == "forecasting" or "time" in selected_x.lower() or "quarter" in selected_x.lower() or "date" in selected_x.lower():
        chart_type = "line"
    elif intent == "distribution" and len(data) <= 6:
        chart_type = "pie"
    elif intent == "anomaly_detection" and len(numeric_fields) > 1:
        chart_type = "scatter"
    else:
        chart_type = "bar"
    return ChartSpec(type=chart_type, title=title, x_axis=selected_x, y_axis=selected_y, data=data)
