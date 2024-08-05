import * as lark from '@larksuiteoapi/node-sdk'
import 'dotenv/config'
import { loadFile, saveFile, unique } from './utils'
import path from 'path'

const baseDir = './data'
const pathJoin = (...paths: string[]) => path.join(baseDir, ...paths)

const appId = process.env.APP_ID as string
const appSecret = process.env.APP_SECRET as string

const client = new lark.Client({ appId, appSecret })

// 获取外勤组信息
const attendanceGroupInfo = await getAttendanceGroupInfo()

const { attendanceGroupName, userIds } = attendanceGroupInfo

async function getAttendanceGroupInfo(): ReturnType<typeof getInfoByGroupId> {
  const path = pathJoin('attendance.json')
  try {
    // 尝试从文件加载
    return await loadFile(path)
  } catch (error) {
    // 加载失败，调用 fetchData 获取数据
    const data = await getInfoByGroupId('7204658043383136257') //外勤组（维保人员/销售人员/其他外勤人员）
    // 保存获取到的数据
    await saveFile(path, data)
    return data
  }
}

async function getInfoByGroupId(group_id: string) {
  const attendanceGroupResponse = await client.attendance.group.get({
    params: {
      employee_type: 'employee_id',
      dept_type: 'open_id',
    },
    path: {
      group_id,
    },
  })

  const attendanceGroupName = attendanceGroupResponse.data?.group_name
  if (!attendanceGroupName) {
    throw new Error('获取外勤组名称失败')
  }
  console.log(`attendanceGroupName: ${attendanceGroupName}`)

  const bind_dept_ids = attendanceGroupResponse.data?.bind_dept_ids ?? []
  const bind_user_ids = attendanceGroupResponse.data?.bind_user_ids ?? []

  console.log(`bind_dept_ids: ${bind_dept_ids}`)
  console.log(`bind_user_ids: ${bind_user_ids}`)

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
  ) as string[]

  console.log(`departmentIds: ${departmentIds}`)
  console.log(`departmentIds.length: ${departmentIds.length}`)

  // 获取部门下的所有员工
  const departmentUsersResponses = await Promise.all(
    departmentIds.map(deptId =>
      client.contact.user.findByDepartment({
        params: {
          user_id_type: 'user_id',
          department_id: deptId,
          page_size: 50,
        },
      })
    )
  )

  const userIds = unique(
    departmentUsersResponses
      .map(res => res.data?.items?.map(item => item.user_id))
      .flat()
      .filter(Boolean)
      .concat(bind_user_ids)
  ) as string[]

  console.log(`userIds: ${userIds}`)
  console.log(`userIds.length: ${userIds.length}`)

  return {
    attendanceGroupName,
    userIds,
  }
}
