"""merge manage flow and source column

Revision ID: d8af39d0f566
Revises: d4e5f6a7b8c9, f5a6b7c8d9e0
Create Date: 2026-03-27 21:03:00.085217

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8af39d0f566'
down_revision: Union[str, None] = ('d4e5f6a7b8c9', 'f5a6b7c8d9e0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
