import DefaultTheme from 'vitepress/theme'
import { watch, nextTick, onMounted } from 'vue'
import { useRoute } from 'vitepress'
import './custom.css'

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()

    onMounted(() => {
      const initZoom = () => {
        import('medium-zoom').then((m) => {
          m.default('.vp-doc img:not(.no-zoom)', { background: 'var(--vp-c-bg)' })
        })
      }

      // 初始化
      initZoom()

      // 路由变化时重新初始化
      watch(
        () => route.path,
        () => nextTick(() => initZoom())
      )
    })
  }
}
