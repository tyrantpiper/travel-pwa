import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { API_HOST } from '@/lib/api'
import { Trip } from '@/lib/itinerary-types'
import PublicTripView from './PublicTripView'

// ISR: Revalidate every 1 hour
export const revalidate = 3600

interface PageProps {
    params: Promise<{ shareCode: string }>
}

// Fetch trip data on server
async function getTripByPublicId(publicId: string): Promise<Trip | null> {
    try {
        const res = await fetch(`${API_HOST}/api/trips/share/${publicId}`, {
            next: { revalidate: 3600 }
        })
        if (!res.ok) return null
        return res.json()
    } catch {
        return null
    }
}

// Dynamic metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { shareCode: publicId } = await params
    const trip = await getTripByPublicId(publicId)

    if (!trip) {
        return {
            title: '行程不存在 | Tabidachi 旅立ち',
        }
    }

    return {
        title: `${trip.title} | Tabidachi 旅立ち`,
        description: `探索 ${trip.title} 的完整行程規劃`,
        openGraph: {
            title: trip.title,
            description: `探索 ${trip.title} 的完整行程規劃`,
            images: trip.cover_image ? [trip.cover_image] : [],
        },
    }
}

export default async function SharePage({ params }: PageProps) {
    const { shareCode: publicId } = await params
    const trip = await getTripByPublicId(publicId)

    if (!trip) {
        notFound()
    }

    return <PublicTripView trip={trip} />
}
