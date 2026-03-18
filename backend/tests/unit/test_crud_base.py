# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import BaseModel

from app.crud.base import CRUDBase


class MockModel:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


class MockSchema(BaseModel):
    name: str


@pytest.mark.asyncio
async def test_crud_base_create_with_dict():
    # Setup
    crud = CRUDBase(MockModel)
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    obj_in = {"name": "test_name", "extra": "field"}

    # Execute
    result = await crud.create(db, obj_in=obj_in)

    # Assert
    assert result.name == "test_name"
    assert result.extra == "field"
    db.add.assert_called_once()
    db.flush.assert_called_once()


@pytest.mark.asyncio
async def test_crud_base_create_with_model():
    # Setup
    crud = CRUDBase(MockModel)
    db = MagicMock()
    db.add = MagicMock()
    db.flush = AsyncMock()

    obj_in = MockSchema(name="test_name")

    # Execute
    result = await crud.create(db, obj_in=obj_in)

    # Assert
    assert result.name == "test_name"
    db.add.assert_called_once()
    db.flush.assert_called_once()
