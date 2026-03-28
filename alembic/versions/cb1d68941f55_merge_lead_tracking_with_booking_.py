"""merge lead tracking with booking dropoffs

Revision ID: cb1d68941f55
Revises: 52b81f198611, a1b2c3d4e5f7
Create Date: 2026-03-28 13:59:29.948296

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cb1d68941f55'
down_revision: Union[str, None] = ('52b81f198611', 'a1b2c3d4e5f7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
