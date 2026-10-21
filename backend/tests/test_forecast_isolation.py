from uuid import uuid4

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import ForecastArtifact, Organization, OrganizationMember, User


def test_forecast_artifact_has_tenant_scope() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    organization_id = uuid4()
    with Session(engine) as db:
        organization = Organization(id=organization_id, name="Org", slug="org")
        user = User(email="user@example.com")
        db.add_all([organization, user])
        db.flush()
        db.add(OrganizationMember(organization_id=organization.id, user_id=user.id, role="owner"))
        db.commit()
        artifacts = list(db.scalars(select(ForecastArtifact).where(ForecastArtifact.organization_id == organization_id)))
    assert artifacts == []
