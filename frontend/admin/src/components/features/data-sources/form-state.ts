// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export interface FormState {
  name: string
  type: "internal" | "s3"
  description: string
  endpoint: string
  bucket_name: string
  access_key: string
  secret_key: string
  use_ssl: boolean
  root_prefix: string    // 用户填写的部分，保存到后端
  tenant_base: string    // 租户自动前缀（如 acme-corp/），不可编辑，仅用于路径预览
}

export const EMPTY_FORM: FormState = {
  name: "",
  type: "internal",
  description: "",
  endpoint: "",
  bucket_name: "",
  access_key: "",
  secret_key: "",
  use_ssl: true,
  root_prefix: "",
  tenant_base: "",
}
