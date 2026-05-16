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

from pydantic import BaseModel, ConfigDict


class TaskBase(BaseModel):
    task_type: str
    status: str
    progress: float = 0.0
    job_id: str | None = None
    site_id: int | None = None


class TaskCreate(TaskBase):
    tenant_id: int
    created_by: str
    payload: dict | None = None


class Task(TaskBase):
    id: int
    tenant_id: int
    payload: dict | None = None
    result: dict | None = None
    error: str | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
