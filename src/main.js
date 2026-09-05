import './style.css'
import { bootstrap } from './app.js'
import { applyTheme } from './config/theme.js'

applyTheme()
bootstrap(document.querySelector('#app'))
