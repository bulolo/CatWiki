import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileQuestion, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <FileQuestion className="h-8 w-8 text-slate-600" />
          </div>
          <CardTitle className="text-2xl">页面不存在</CardTitle>
          <CardDescription className="text-base mt-2">
            抱歉，您访问的页面不存在
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-600 text-center">
              请检查 URL 是否正确，或返回首页继续浏览
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Link href="/" className="w-full">
              <Button className="w-full" size="lg">
                <Home className="mr-2 h-4 w-4" />
                返回首页
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
