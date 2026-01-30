import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Home, Search } from "lucide-react"

export default function DomainNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl">站点不存在</CardTitle>
          <CardDescription className="text-base mt-2">
            您访问的站点不存在或已被删除
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-600 mb-2">可能的原因：</p>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li>站点域名输入错误</li>
              <li>站点已被删除或禁用</li>
              <li>您没有访问此站点的权限</li>
            </ul>
          </div>
          
          <div className="flex flex-col gap-3">
            <Link href="/" className="w-full">
              <Button className="w-full" size="lg">
                <Home className="mr-2 h-4 w-4" />
                返回首页
              </Button>
            </Link>
            
            <Link href="/sites" className="w-full">
              <Button variant="outline" className="w-full" size="lg">
                <Search className="mr-2 h-4 w-4" />
                查看所有站点
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
