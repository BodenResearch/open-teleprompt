'use client';
import { Box, IconButton, Typography } from '@mui/material';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import MarkdownBlock from '@agixt/interactive/MarkdownBlock';
import { GoogleDoc } from './api/v1/google/GoogleConnector';
import { ArrowBack, PlayArrow, StopCircle } from '@mui/icons-material';
import { EventSourcePolyfill } from 'event-source-polyfill';

export type TeleprompterProps = {
  googleDoc: GoogleDoc;
  setSelectedDocument: any;
};

export default function Teleprompter({ googleDoc, setSelectedDocument }: TeleprompterProps) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const mainRef = useRef(null);
  const [mainWindow, setMainWindow] = useState<Boolean>(false);
  const [playingInterval, setPlayingInterval] = useState(null);
  const handleInputScroll = useCallback(() => {
    if (mainWindow) {
      const scrollPosition = mainRef.current.scrollTop;
      fetch('/api/v1/scroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getCookie('jwt'),
        },
        body: JSON.stringify({ position: scrollPosition }),
      });
    }
  }, [mainWindow]);

  const handleReceivedScroll = useCallback(
    (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      if (typeof data === 'boolean') {
        setMainWindow(() => data); // Use functional update
      } else {
        mainRef.current.scrollTo(0, Number(data.position));
        if (data.selectedDocument) {
          setSelectedDocument(data.selectedDocument);
        }
      }
    },
    [setSelectedDocument],
  );

  const handleKillInterval = useCallback(() => {
    if (mainWindow) {
      clearInterval(playingInterval);
      setPlayingInterval(null);
    }
  }, [mainWindow, playingInterval, setPlayingInterval]);
  const handleInterval = useCallback(() => {
    if (!playingInterval) {
      const currentScroll = mainRef.current.scrollTop;
      mainRef.current.scrollTo(0, Number(mainRef.current.scrollTop + 30));
      if (mainRef.current.scrollTop == currentScroll) {
        console.log('Hit bottom, killing interval: ', playingInterval);
        handleKillInterval();
      }
    }
  }, [mainRef, playingInterval, handleKillInterval]);
  useEffect(() => {
    mainRef.current = document.querySelector('main');

    mainRef.current.addEventListener('scroll', handleInputScroll);
    eventSourceRef.current = new EventSourcePolyfill('/api/v1/scroll', {
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
      clearInterval(playingInterval);
    };
  }, [handleInputScroll, handleReceivedScroll]);

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
  useEffect(() => {
    console.log(playingInterval);
  }, [playingInterval]);
  return (
    <>
      <Box px='14rem'>
        <Typography variant='h2' display='flex' alignItems='center' justifyContent='center'>
          <IconButton
            onClick={() => {
              setSelectedDocument(null);
            }}
          >
            <ArrowBack />
          </IconButton>
          {googleDoc.name} - {mainWindow ? 'Main Window' : 'Follower Window'}
        </Typography>
        {error ? (
          <Typography variant='body1'>{error.message}</Typography>
        ) : (
          <MarkdownBlock content={isLoading ? 'Loading googleDoc...' : data} />
        )}
      </Box>
      <Box width='10rem' height='6rem' position='fixed' top='6rem' left='2rem'>
        <Typography variant='caption' textAlign='center' width='100%'>
          Control Panel
        </Typography>
        <Box display='flex' justifyContent='center' gap='0.5rem'>
          {!playingInterval && (
            <IconButton
              onClick={() => {
                if (mainWindow) {
                  const interval = setInterval(handleInterval, 500);
                  console.log('Interval created: ', interval);
                  setPlayingInterval(interval);
                }
              }}
            >
              <PlayArrow />
            </IconButton>
          )}
          {playingInterval && (
            <IconButton onClick={handleKillInterval}>
              <StopCircle />
            </IconButton>
          )}
        </Box>
      </Box>
    </>
  );
}
