const CACHE_NAME = 'tabidachi-v3'
const STATIC_CACHE = 'tabidachi-static-v3'

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

    // API 請求：全部使用 NetworkFirst 策略
    // 確保任何 mutation (新增/刪除/編輯) 後都能立即看到最新資料
    if (url.pathname.startsWith('/api') || request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // 只緩存成功的 GET 請求，供離線使用
                    if (networkResponse.ok) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, networkResponse.clone())
                        })
                    }
                    return networkResponse
                })
                .catch(() => {
                    // 離線時使用緩存
                    return caches.match(request)
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
