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

import logging

from arq import func

from app.core.infra.config import settings
from app.core.queue.redis import redis_settings
from app.worker.document_tasks import process_import_parsing, process_vectorize

logger = logging.getLogger(__name__)


async def startup(ctx):
    from app.core.common.logger import setup_logging

    setup_logging()
    logger.info("🚀 Arq Worker 正在启动...")
    registered_funcs = [
        f if isinstance(f, str) else getattr(f, "name", getattr(f, "__name__", str(f)))
        for f in WorkerSettings.functions
    ]
    logger.info(
        f"📋 已注册函数: {registered_funcs} | "
        f"max_tries={WorkerSettings.max_tries} "
        f"job_timeout={WorkerSettings.job_timeout}s "
        f"max_jobs={WorkerSettings.max_jobs}"
    )


async def shutdown(ctx):
    logger.info("🛑 Arq Worker 正在关闭...")


class WorkerSettings:
    """Arq Worker 配置（由 settings 驱动，可通过环境变量调整）"""

    functions = [
        func(process_import_parsing, name="process_import_parsing"),
        func(process_vectorize, name="process_vectorize"),
    ]
    redis_settings = redis_settings
    on_startup = startup
    on_shutdown = shutdown

    max_tries = settings.WORKER_MAX_TRIES
    job_timeout = settings.WORKER_JOB_TIMEOUT
    max_jobs = settings.WORKER_MAX_JOBS
