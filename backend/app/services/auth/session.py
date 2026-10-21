from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.core.config import Settings


class SessionService:
    def __init__(self, settings: Settings) -> None:
        if not settings.secret_key:
            raise ValueError("SECRET_KEY must be configured before sessions are used")
        self.serializer = URLSafeTimedSerializer(settings.secret_key, salt="analytics-session")
        self.max_age = settings.session_max_age_seconds

    def create(self, user_id: str) -> str:
        return self.serializer.dumps({"user_id": user_id})

    def read(self, value: str) -> str | None:
        try:
            payload = self.serializer.loads(value, max_age=self.max_age)
        except BadSignature:
            return None
        user_id = payload.get("user_id")
        return user_id if isinstance(user_id, str) else None
