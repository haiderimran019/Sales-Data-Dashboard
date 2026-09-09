from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.history import scoped_project_query
from app.db.base import Base
from app.models import Organization, OrganizationMember, Project, User


def test_project_query_is_limited_to_member_organizations() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        first_org = Organization(name="First", slug="first")
        second_org = Organization(name="Second", slug="second")
        user = User(email="user@example.com")
        db.add_all([first_org, second_org, user])
        db.flush()
        db.add(OrganizationMember(organization_id=first_org.id, user_id=user.id, role="member"))
        db.add_all([
            Project(organization_id=first_org.id, name="Visible", slug="visible"),
            Project(organization_id=second_org.id, name="Hidden", slug="hidden"),
        ])
        db.commit()

        visible = list(db.scalars(scoped_project_query(user, db)))

    assert [project.name for project in visible] == ["Visible"]
