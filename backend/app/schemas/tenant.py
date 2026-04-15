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

from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field


class TenantBase(BaseModel):
    name: str
    slug: str
    domain: str | None = None
    logo_url: str | None = None
    description: str | None = None
    status: str = "trial"


class TenantCreate(TenantBase):
    pass


class TenantUpdate(TenantBase):
    name: str | None = None
    slug: str | None = None


class TenantInDBBase(TenantBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def is_demo(self) -> bool:
        return False


class TenantSchema(TenantInDBBase):
    pass
