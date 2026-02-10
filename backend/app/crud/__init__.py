# Copyright 2024 CatWiki Authors
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

from app.crud.collection import crud_collection
from app.crud.document import crud_document
from app.crud.document_view_event import crud_document_view_event
from app.crud.site import crud_site  # noqa
from app.crud.system_config import crud_system_config  # noqa
from app.crud.user import crud_user  # noqa
from app.crud.tenant import crud_tenant  # noqa

__all__ = [
    "crud_user",
    "crud_site",
    "crud_collection",
    "crud_document",
    "crud_document_view_event",
    "crud_system_config",
    "crud_tenant",
]
