const CACHE_NAME = 'tabidachi-v2'
const STATIC_CACHE = 'tabidachi-static-v2'

// 需要緩存的靜態資源
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
    '/icon.png',
]

// 安裝事件 - 預緩存靜態資源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(STATIC_ASSETS)
        })
    )
    self.skipWaiting()
})

// 激活事件 - 清理舊緩存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
                    .map((name) => caches.delete(name))
            )
        })
    )
    self.clients.claim()
})

// 請求攔截 - 實現緩存策略
self.addEventListener('fetch', (event) => {
    const { request } = event
    const url = new URL(request.url)

    // 跳過非 GET 請求
    if (request.method !== 'GET') return

    // API 請求策略
    if (url.pathname.startsWith('/api') || request.url.includes('/api/')) {
        // trips 列表使用 NetworkFirst - 確保刪除/新增後立即更新
        if (request.url.includes('/api/trips') && !request.url.includes('/expenses')) {
            event.respondWith(
                fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse.ok) {
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, networkResponse.clone())
                            })
                        }
                        return networkResponse
                    })
                    .catch(() => caches.match(request)) // 離線時用緩存
            )
            return
        }

        // 其他 API：Stale-While-Revalidate 策略
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((networkResponse) => {
                        if (networkResponse.ok) {
                            cache.put(request, networkResponse.clone())
                        }
                        return networkResponse
                    }).catch(() => cachedResponse) // 網路失敗時返回緩存

                    // 有緩存就先顯示，同時背景更新
                    return cachedResponse || fetchPromise
                })
            })
        )
        return
    }


    // 圖片：Cache First 策略
    if (request.destination === 'image') {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                return cachedResponse || fetch(request).then((networkResponse) => {
                    return caches.open(STATIC_CACHE).then((cache) => {
                        cache.put(request, networkResponse.clone())
                        return networkResponse
                    })
                })
            })
        )
        return
    }

    // 其他請求：Network First 策略
    event.respondWith(
        fetch(request).catch(() => caches.match(request))
    )
})
