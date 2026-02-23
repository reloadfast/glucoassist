from pydantic import BaseModel


class RatioEstimate(BaseModel):
    mean: float
    ci_lower: float
    ci_upper: float
    n: int


class TimeBlockRatio(BaseModel):
    block: str
    icr: RatioEstimate | None
    cf: RatioEstimate | None
    icr_samples: int
    cf_samples: int
    insufficient_data: bool


class RatiosResponse(BaseModel):
    blocks: list[TimeBlockRatio]
    days_analyzed: int
    disclaimer: str
