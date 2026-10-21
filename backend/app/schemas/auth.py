from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None
    profile_image_url: str | None
    last_login_at: datetime | None


class SessionResponse(BaseModel):
    user: UserResponse
