import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import useSWR from 'swr';
import MarkdownBlock from '@agixt/interactive/MarkdownBlock';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Play, Square, ArrowUpDown, ArrowLeftRight, ChevronRight, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';

export type GoogleDoc = {
  id: string;
  name: string;
};

export type TeleprompterProps = {
  googleDoc: GoogleDoc;
  setSelectedDocument: (doc: GoogleDoc | null) => void;
};

export default function Teleprompter({ googleDoc, setSelectedDocument }: TeleprompterProps) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const mainRef = useRef(null);
  const [clientID, setClientID] = useState<string>(uuidv4());
  const [mainWindow, setMainWindow] = useState<boolean>(false);
  const [autoScrolling, setAutoScrolling] = useState<boolean>(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(5);
  const [flipVertical, setFlipVertical] = useState<boolean>(false);
  const [flipHorizontal, setFlipHorizontal] = useState<boolean>(false);
  const playingIntervalRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);

  const handleInputScroll = useCallback(() => {
    if (mainWindow) {
      const scrollPosition = mainRef.current.scrollTop;
      fetch('/api/v1/scroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getCookie('jwt'),
        },
        body: JSON.stringify({ clientID: clientID, position: scrollPosition }),
      });
    }
  }, [mainWindow, clientID]);

  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      fetch('/api/v1/scroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getCookie('jwt'),
        },
        body: JSON.stringify({ clientID: clientID }),
      });
    }, 5000) as unknown as number;
    return () => {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    };
  }, [clientID]);

  const handleReceivedScroll = useCallback(
    (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (data.main) {
        setMainWindow(data.main === clientID);
      } else if (!mainWindow) {
        mainRef.current.scrollTo(0, Number(data.position));
        if (data.selectedDocument) {
          setSelectedDocument(data.selectedDocument);
        }
      }
    },
    [setSelectedDocument, mainWindow, clientID],
  );

  const handleKillInterval = useCallback(() => {
    if (mainWindow && playingIntervalRef.current !== null) {
      setAutoScrolling(false);
      clearInterval(playingIntervalRef.current);
      playingIntervalRef.current = null;
    }
  }, [mainWindow]);

  const handleInterval = useCallback(() => {
    const currentScroll = mainRef.current.scrollTop;
    mainRef.current.scrollTo(0, Number(mainRef.current.scrollTop + autoScrollSpeed));
    if (mainRef.current.scrollTop === currentScroll) {
      handleKillInterval();
    }
  }, [mainRef, autoScrollSpeed, handleKillInterval]);

  useEffect(() => {
    mainRef.current = document.querySelector('main');
    mainRef.current.addEventListener('scroll', handleInputScroll);

    eventSourceRef.current = new EventSourcePolyfill(`/api/v1/scroll?clientID=${clientID}`, {
      headers: {
        Authorization: getCookie('jwt'),
      },
    });
    eventSourceRef.current.addEventListener('message', handleReceivedScroll);

    return () => {
      mainRef.current.removeEventListener('scroll', handleInputScroll);
      if (eventSourceRef.current) {
        eventSourceRef.current.removeEventListener('message', handleReceivedScroll);
        eventSourceRef.current.close();
      }
      clearInterval(playingIntervalRef.current);
      playingIntervalRef.current = null;
    };
  }, [handleInputScroll, handleReceivedScroll, clientID]);

  const { data, isLoading, error } = useSWR(`/docs/${googleDoc.id}`, async () => {
    return googleDoc
      ? (
          await axios.get(`${process.env.NEXT_PUBLIC_AUTH_SERVER}/v1/google/docs?id=${googleDoc.id}`, {
            headers: {
              Authorization: getCookie('jwt'),
            },
          })
        ).data
      : null;
  });

  return (
    <>
      <div className='container mx-auto px-16'>
        <h1 className='flex items-center justify-center text-3xl font-bold mb-6'>
          <Button variant='ghost' size='icon' onClick={() => setSelectedDocument(null)} className='mr-2'>
            <ArrowLeft className='h-6 w-6' />
          </Button>
          {googleDoc.name} - {mainWindow ? 'Main Window' : 'Follower Window'}
        </h1>

        {error ? (
          <Card>
            <CardContent>
              <p className='text-base'>Unable to load document from Google, an error occurred.</p>
              <p className='text-base text-destructive'>{error.message}</p>
            </CardContent>
          </Card>
        ) : (
          <div
            style={{
              transform: `scale(${flipHorizontal ? '-1' : '1'}, ${flipVertical ? '-1' : '1'})`,
            }}
          >
            <MarkdownBlock content={isLoading ? 'Loading Document from Google...' : data} />
          </div>
        )}
      </div>

      <Card className='fixed top-24 left-8 w-48'>
        <CardHeader>
          <CardTitle className='text-sm text-center'>Control Panel</CardTitle>
        </CardHeader>
        <CardContent>
          {!mainWindow ? (
            <Button
              onClick={() => {
                fetch('/api/v1/scroll', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: getCookie('jwt'),
                  },
                  body: JSON.stringify({ clientID: clientID, main: clientID }),
                });
              }}
            >
              Assume Control
            </Button>
          ) : !autoScrolling ? (
            <div className='space-y-4'>
              <div className='flex justify-center space-x-2'>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => {
                    if (mainWindow && playingIntervalRef.current === null) {
                      setAutoScrolling(true);
                      const interval = setInterval(handleInterval, 500);
                      playingIntervalRef.current = interval as unknown as number;
                    }
                  }}
                >
                  <Play className='h-4 w-4' />
                </Button>
                <Button variant='outline' size='icon' onClick={() => mainWindow && setFlipVertical((old) => !old)}>
                  <ArrowUpDown className={`h-4 w-4 ${flipVertical ? 'text-primary' : ''}`} />
                </Button>
                <Button variant='outline' size='icon' onClick={() => mainWindow && setFlipHorizontal((old) => !old)}>
                  <ArrowLeftRight className={`h-4 w-4 ${flipHorizontal ? 'text-primary' : ''}`} />
                </Button>
              </div>

              <div className='space-y-2'>
                <div className='flex justify-between'>
                  <ChevronRight className='h-4 w-4' />
                  <ChevronsRight className='h-4 w-4' />
                </div>
                <Slider
                  min={5}
                  max={50}
                  step={5}
                  value={[autoScrollSpeed]}
                  onValueChange={(value) => setAutoScrollSpeed(value[0])}
                />
              </div>
            </div>
          ) : (
            <Button variant='outline' size='icon' onClick={handleKillInterval}>
              <Square className='h-4 w-4' />
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
