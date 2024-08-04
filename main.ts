import * as lark from '@larksuiteoapi/node-sdk'
import 'dotenv/config'
import { unique } from './utils'

const appId = process.env.APP_ID as string
const appSecret = process.env.APP_SECRET as string

const client = new lark.Client({ appId, appSecret })

// 获取外勤组信息
const attendanceGroupResponse = await client.attendance.group.get({
  params: {
    employee_type: 'employee_id',
    dept_type: 'open_id',
  },
  path: {
    group_id: '7204658043383136257', //外勤组（维保人员/销售人员/其他外勤人员）
  },
})

const bind_dept_ids = attendanceGroupResponse.data?.bind_dept_ids ?? []

console.log(`bind_dept_ids: ${bind_dept_ids}`)

// 获取部门下的所有子部门
const departmentChildrenResponses = await Promise.all(
  bind_dept_ids.map(deptId =>
    client.contact.department.children({
      params: {
        user_id_type: 'user_id',
        fetch_child: true,
        page_size: 50,
      },
      path: {
        department_id: deptId,
      },
    })
  )
)

const departmentIds = unique(
  departmentChildrenResponses
    .map(res => res.data?.items?.map(item => item.open_department_id))
    .flat()
    .filter(Boolean)
    .concat(bind_dept_ids)
)

console.log(`departmentIds: ${departmentIds}`)
