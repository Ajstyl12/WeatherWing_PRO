import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { WeatherData } from './types';
import { getWeatherDataForCity } from './services/geminiService';
import SearchBar from './components/SearchBar';
import WeatherDisplay from './components/WeatherDisplay';
import Globe from './components/Globe';
import Sky from './components/Sky';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
    const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDay, setIsDay] = useState(true);
    const [globeKey, setGlobeKey] = useState(0); // Key to force Globe re-render
    const [cityTime, setCityTime] = useState<string | null>(null);

    const globeRef = useRef<{ pointOfView: (coords: { lat: number; lng: number; altitude: number }, duration: number) => void }>();

    useEffect(() => {
        if (weatherData?.localTime) {
            const hour = parseInt(weatherData.localTime.split(':')[0], 10);
            const day = hour >= 6 && hour < 18;
            setIsDay(day);
            document.documentElement.classList.toggle('dark', !day);
        }
    }, [weatherData]);

    // Live-updating clock for the searched city's local time.
    // Prefer an IANA timezone identifier (weatherData.timeZone), then utcOffsetMinutes, then fallback to provided localTime string.
    useEffect(() => {
        let timer: number | undefined;

        if (weatherData?.timeZone) {
            const tick = () => {
                try {
                    const parts = new Intl.DateTimeFormat('en', {
                        hour12: false,
                        timeZone: weatherData.timeZone,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }).formatToParts(new Date());

                    const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
                    const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
                    const ss = parts.find((p) => p.type === 'second')?.value ?? '00';
                    setCityTime(`${hh}:${mm}:${ss}`);
                } catch (err) {
                    // If Intl fails for any reason, clear and fallback
                    console.warn('Timezone formatting failed, falling back:', err);
                    setCityTime(null);
                }
            };

            tick();
            timer = window.setInterval(tick, 1000);
        } else if (typeof weatherData?.utcOffsetMinutes === 'number') {
            const tick = () => {
                const ms = Date.now() + weatherData.utcOffsetMinutes * 60000;
                const dt = new Date(ms);
                // using UTC getters because we shifted epoch to target zone
                const hh = String(dt.getUTCHours()).padStart(2, '0');
                const mm = String(dt.getUTCMinutes()).padStart(2, '0');
                const ss = String(dt.getUTCSeconds()).padStart(2, '0');
                setCityTime(`${hh}:${mm}:${ss}`);
            };

            tick();
            timer = window.setInterval(tick, 1000);
        } else if (weatherData?.localTime) {
            // Fallback: start from provided HH:mm and increment seconds locally
            const [hhStr, mmStr] = weatherData.localTime.split(':');
            const hh = parseInt(hhStr, 10) || 0;
            const mm = parseInt(mmStr, 10) || 0;
            let seconds = ((hh % 24) * 3600) + (mm * 60);

            const tick = () => {
                const h = Math.floor(seconds / 3600) % 24;
                const m = Math.floor((seconds % 3600) / 60);
                const s = seconds % 60;
                setCityTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
                seconds = (seconds + 1) % (24 * 3600);
            };

            tick();
            timer = window.setInterval(tick, 1000);
        } else {
            setCityTime(null);
        }

        return () => {
            if (timer) window.clearInterval(timer);
        };
    }, [weatherData]);
    
    useEffect(() => {
        // Set a default theme on mount
        document.documentElement.classList.remove('dark');
    }, []);

    const handleSearch = useCallback(async (city: string) => {
        if (!city) return;
        setLoading(true);
        setError(null);
        setWeatherData(null);
        try {
            const data = await getWeatherDataForCity(city);
            setWeatherData(data);
            if (globeRef.current) {
                globeRef.current.pointOfView({ lat: data.latitude, lng: data.longitude, altitude: 1.5 }, 2000);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Choose background gradient based on city weather condition and day/night.
    const getBackgroundFor = (condition?: string, day = true) => {
        const daySuffix = day ? '' : ' (night)';
    if (!condition) return day ? 'linear-gradient(120deg, #87CEEB 0%, #a2d2ff 100%)' : 'linear-gradient(120deg, #020417 0%, #0b1220 100%)';

        const c = condition.toLowerCase();
        if (c.includes('clear')) {
            return day
                ? 'linear-gradient(120deg, #87CEEB 0%, #ffd97a 100%)' // sunny day
                : 'linear-gradient(120deg, #020417 0%, #0b1220 100%)'; // clear night
        }
        if (c.includes('cloud')) {
            return day
                ? 'linear-gradient(120deg, #cfd9df 0%, #e2ebf0 100%)' // cloudy day
                : 'linear-gradient(120deg, #070915 0%, #262b36 100%)'; // cloudy night
        }
        if (c.includes('rain') || c.includes('drizzle') || c.includes('thunder')) {
            return day
                ? 'linear-gradient(120deg, #6b8ba4 0%, #9fb3c8 100%)' // rainy day
                : 'linear-gradient(120deg, #04101b 0%, #112233 100%)'; // rainy night
        }
        if (c.includes('snow')) {
            return 'linear-gradient(120deg, #e6f0f6 0%, #ffffff 100%)';
        }
        if (c.includes('mist') || c.includes('haze') || c.includes('fog')) {
            return day
                ? 'linear-gradient(120deg, #c8d0d8 0%, #e6eef4 100%)'
                : 'linear-gradient(120deg, #05060b 0%, #161922 100%)';
        }

        // Default fallback
        return day ? 'linear-gradient(120deg, #87CEEB 0%, #a2d2ff 100%)' : 'linear-gradient(120deg, #0b1424 0%, #1c2a4a 100%)';
    };

    const backgroundStyle = getBackgroundFor(weatherData?.condition, isDay);

    return (
        <motion.main
            className="w-full h-screen overflow-hidden flex flex-col lg:flex-row text-white font-sans"
            animate={{ background: backgroundStyle }}
            transition={{ duration: 1.5 }}
            style={{ background: backgroundStyle }}
        >
            <div className="w-full lg:w-1/3 h-full p-4 md:p-8 flex flex-col backdrop-blur-sm lg:backdrop-filter-none bg-black/10 lg:bg-transparent relative z-10">
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-white dark:text-gray-100">WeatherWing</h1>
                    <p className="text-white/80 dark:text-gray-300">Weather at your fingertips.</p>
                    {weatherData && (
                        <div className="mt-3 flex items-center gap-4">
                            <span className="font-extrabold text-2xl md:text-3xl tracking-tight drop-shadow-sm text-white">{weatherData.city}, {weatherData.country}</span>
                            <span className="ml-2 text-base md:text-lg font-mono bg-white/6 text-white/95 px-3 py-1 rounded-lg ring-1 ring-white/10 shadow-sm">
                                {cityTime ?? weatherData.localTime}
                            </span>
                        </div>
                    )}
                </header>
                
                <SearchBar onSearch={handleSearch} loading={loading} />

                <div className="flex-grow flex items-center justify-center mt-8">
                    <AnimatePresence>
                        {loading && (
                             <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center"
                            >
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                                <p className="mt-4 text-lg">Fetching weather...</p>
                            </motion.div>
                        )}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="text-center p-4 bg-red-500/30 rounded-lg"
                            >
                                <p className="font-bold">Error</p>
                                <p>{error}</p>
                            </motion.div>
                        )}
                        {weatherData && (
                            <WeatherDisplay data={weatherData} />
                        )}
                        {!loading && !error && !weatherData && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center text-white/90"
                            >
                                <h2 className="text-2xl">Welcome to WeatherWing</h2>
                                <p>Search for a city to get the latest weather forecast.</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="absolute inset-0 lg:relative lg:w-2/3 h-full z-10">
                <Sky time={cityTime ?? weatherData?.localTime} isDay={isDay} />
                <Globe 
                    key={globeKey}
                    globeRef={globeRef} 
                    isDay={isDay} 
                    pointsData={weatherData ? [{ lat: weatherData.latitude, lng: weatherData.longitude, size: 0.5, color: 'white' }] : []}
                />
            </div>
        </motion.main>
    );
};

export default App;