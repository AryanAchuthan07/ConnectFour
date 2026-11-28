import { useEffect } from 'react'
import { navigate, parseRoute, usePath } from './router'
import { GameScreen } from './screens/GameScreen'
import { HomeScreen } from './screens/HomeScreen'

export function App() {
  const route = parseRoute(usePath())

  useEffect(() => {
    if (route.name === 'unknown') navigate('/', { replace: true })
  }, [route.name])

  // The key gives each game a fresh screen, so nothing carries over from the previous one.
  if (route.name === 'game') return <GameScreen key={route.id} id={route.id} />
  return <HomeScreen />
}
