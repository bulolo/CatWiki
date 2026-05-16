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

"""数据源服务包

分层：
- constants: 静态常量
- paths:     纯函数路径计算
- storage:   minio 协议层（被 service 和 worker 共享）
- service:   业务编排（CRUD + 文件操作 + 导入任务）
"""

from app.services.data_source.service import DataSourceService, get_data_source_service

__all__ = ["DataSourceService", "get_data_source_service"]
