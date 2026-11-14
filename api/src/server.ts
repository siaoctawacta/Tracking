import { config } from './config'
import { createApp } from './app'

createApp().listen(config.port, () => {
  console.log(`Benit Cargo API → http://localhost:${config.port}/api/v1`)
})
