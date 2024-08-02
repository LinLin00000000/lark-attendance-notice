import { fetchWithTenantAuthorization } from './utils'
import 'dotenv/config'

const groupId = "7204658043383136257" //外勤组（维保人员/销售人员/其他外勤人员）

const attendanceGroupInfo = await
    fetchWithTenantAuthorization(`https://open.feishu.cn/open-apis/attendance/v1/groups/${groupId}`
        + '?employee_type=employee_id&dept_type=open_id')

const bind_dept_ids: string[] = attendanceGroupInfo.bind_dept_ids
const bind_user_ids: string[] = attendanceGroupInfo.bind_user_ids

console.log(`bind_dept_ids: ${bind_dept_ids}`)
console.log(`bind_user_ids: ${bind_user_ids}`)

// 获取部门下的所有子部门
const ress = await Promise.all(bind_dept_ids.map(async (deptId) => {

    const res = await
        fetchWithTenantAuthorization(`https://open.feishu.cn/open-apis/contact/v3/departments/${deptId}/children`
            + '?user_id_type=user_id&fetch_child=true&page_size=50')
    return res.items?.map((item) => item.open_department_id)
}))

console.log(`ress: ${[...new Set(ress.flat().filter(Boolean))]}`)
