import 'dotenv/config'

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 封装 fetch 请求，添加 Authorization header
 * @param {string} url 请求的 URL
 * @param {RequestInit} [options={}] fetch 请求的配置对象，默认为空对象
 * @param {() => Promise<string>} tokenProvider 提供 token 的函数
 * @returns {Promise<any>} 返回解析后的 JSON 数据的 data 属性或抛出错误
 */
async function fetchWithAuthorization(
  url: string,
  options: RequestInit = {},
  tokenProvider: () => Promise<string>
): Promise<any> {
  const token = await tokenProvider()
  const headers = new Headers(options.headers || {})
  headers.append('Authorization', `Bearer ${token}`)

  const fetchOptions = {
    ...options,
    headers: headers,
  }

  return fetchWithRetry(url, fetchOptions)
}

async function fetchWithRetry(
  url: string,
  fetchOptions: RequestInit,
  maxAttempts = 3
) {
  let attempts = 0

  // Try to fetch data and process JSON
  async function performFetch() {
    const response = await fetch(url, fetchOptions)
    let data
    try {
      data = await response.json()
    } catch (error) {
      // Throw error if JSON parsing fails
      throw new Error(`Failed to parse JSON response: ${error.message}`)
    }

    if (response.ok && data.code === 0) {
      return data.data ?? data
    } else {
      // Include detailed API error information in the thrown Error
      throw new Error(
        `HTTP status ${response.status}, API code ${data.code}: ${data.msg}`
      )
    }
  }

  while (attempts++ < maxAttempts) {
    try {
      return await performFetch()
    } catch (error) {
      console.error('Fetch attempt failed:', error.message)
      if (error.message.includes('Failed to parse JSON')) {
        // If JSON parsing fails, no point in retrying
        throw error
      }

      // Determine if the error is due to rate limiting
      const isRateLimitError =
        error.message.includes('429') ||
        (error.message.includes('400') && error.message.includes('99991400'))
      if (!isRateLimitError || attempts >= maxAttempts) {
        throw new Error(`Failed after ${attempts} attempts: ${error.message}`)
      }

      // Parse retry interval from the response or default to 10 seconds
      const retryAfter =
        error.response.headers.get('x-ogw-ratelimit-reset') || '10'
      console.log(`Rate limit hit, retrying after ${retryAfter} seconds...`)
      await sleep(parseInt(retryAfter, 10) * 1000)
    }
  }
  throw new Error('Max retry attempts reached, failing.')
}

export function fetchWithTenantAuthorization(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  return fetchWithAuthorization(url, options, getTenantAccessToken)
}

export function fetchWithUserAuthorization(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  return fetchWithAuthorization(url, options, getUserAccessToken)
}

export async function getUserAccessToken(): Promise<string> {
  throw new Error('Not implemented')
}

/**
 * 获取租户的访问令牌
 * @returns {Promise<string>} 返回租户的访问令牌
 */
export async function getTenantAccessToken(): Promise<string> {
  const appId = process.env.APP_ID
  const appSecret = process.env.APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('APP_ID and APP_SECRET must be set in the environment.')
  }

  return fetchWithRetry(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    }
  ).then(data => data.tenant_access_token)
}

export async function getAttendanceGroupInfo(groupId: string) {
  const baseUrl = 'https://open.feishu.cn/open-apis/attendance/v1/groups/'
  return fetchWithTenantAuthorization(
    `${baseUrl}${groupId}?employee_type=employee_id&dept_type=open_id`
  )
}

export function unique<T>(iterable: Iterable<T>) {
  return [...new Set(iterable)]
}
