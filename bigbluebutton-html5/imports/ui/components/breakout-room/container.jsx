import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
import AudioService from '/imports/ui/components/audio/service';
import AudioManager from '/imports/ui/services/audio-manager';
import { useMutation } from '@apollo/client';
import BreakoutComponent from './component';
import Service from './service';
import { layoutDispatch, layoutSelect } from '../layout/context';
import {
  didUserSelectedMicrophone,
  didUserSelectedListenOnly,
} from '/imports/ui/components/audio/audio-modal/service';
import { makeCall } from '/imports/ui/services/api';
import useCurrentUser from '/imports/ui/core/hooks/useCurrentUser';
import {
  BREAKOUT_ROOM_END_ALL,
  BREAKOUT_ROOM_SET_TIME,
  USER_TRANSFER_VOICE_TO_MEETING,
  BREAKOUT_ROOM_REQUEST_JOIN_URL,
} from './mutations';
import logger from '/imports/startup/client/logger';

const BreakoutContainer = (props) => {
  const layoutContextDispatch = layoutDispatch();
  const { data: currentUserData } = useCurrentUser((user) => ({
    presenter: user.presenter,
    isModerator: user.isModerator,
  }));
  const amIPresenter = currentUserData?.presenter;
  const amIModerator = currentUserData?.isModerator;
  const isRTL = layoutSelect((i) => i.isRTL);

  const [breakoutRoomEndAll] = useMutation(BREAKOUT_ROOM_END_ALL);
  const [breakoutRoomSetTime] = useMutation(BREAKOUT_ROOM_SET_TIME);
  const [breakoutRoomTransfer] = useMutation(USER_TRANSFER_VOICE_TO_MEETING);
  const [breakoutRoomRequestJoinURL] = useMutation(BREAKOUT_ROOM_REQUEST_JOIN_URL);

  const endAllBreakouts = () => {
    Service.setCapturedContentUploading();
    breakoutRoomEndAll();
  };

  const setBreakoutsTime = (timeInMinutes) => {
    if (timeInMinutes <= 0) return false;

    return breakoutRoomSetTime({ variables: { timeInMinutes } });
  };

  const transferUserToMeeting = (fromMeeting, toMeeting) => {
    breakoutRoomTransfer(
      {
        variables: {
          fromMeetingId: fromMeeting,
          toMeetingId: toMeeting,
        },
      },
    );
  };

  const requestJoinURL = (breakoutRoomId) => {
    breakoutRoomRequestJoinURL({ variables: { breakoutRoomId } });
  };

  return <BreakoutComponent
    amIPresenter={amIPresenter}
    endAllBreakouts={endAllBreakouts}
    setBreakoutsTime={setBreakoutsTime}
    transferUserToMeeting={transferUserToMeeting}
    requestJoinURL={requestJoinURL}
    {...{ layoutContextDispatch, isRTL, amIModerator, ...props }}
  />;
};

export default withTracker((props) => {
  const {
    isNewTimeHigherThanMeetingRemaining,
    findBreakouts,
    getBreakoutRoomUrl,
    meetingId,
    isUserInBreakoutRoom,
  } = Service;

  const breakoutRooms = findBreakouts();
  const isMicrophoneUser = (AudioService.isConnectedToBreakout() || AudioService.isConnected())
    && !AudioService.isListenOnly();
  const isMeteorConnected = Meteor.status().connected;
  const isReconnecting = AudioService.isReconnecting();
  const {
    setBreakoutAudioTransferStatus,
    getBreakoutAudioTransferStatus,
  } = AudioService;

  const logUserCouldNotRejoinAudio = () => {
    logger.warn({
      logCode: 'mainroom_audio_rejoin',
      extraInfo: { logType: 'user_action' },
    }, 'leaving breakout room couldn\'t rejoin audio in the main room');
  };

  const rejoinAudio = () => {
    if (didUserSelectedMicrophone()) {
      AudioManager.joinMicrophone().then(() => {
        makeCall('toggleVoice', null, true).catch(() => {
          AudioManager.forceExitAudio();
          logUserCouldNotRejoinAudio();
        });
      }).catch(() => {
        logUserCouldNotRejoinAudio();
      });
    } else if (didUserSelectedListenOnly()) {
      AudioManager.joinListenOnly().catch(() => {
        logUserCouldNotRejoinAudio();
      });
    }
  };

  return {
    ...props,
    breakoutRooms,
    isNewTimeHigherThanMeetingRemaining,
    getBreakoutRoomUrl,
    isMicrophoneUser,
    meetingId: meetingId(),
    isMeteorConnected,
    isUserInBreakoutRoom,
    forceExitAudio: () => AudioManager.forceExitAudio(),
    rejoinAudio,
    isReconnecting,
    setBreakoutAudioTransferStatus,
    getBreakoutAudioTransferStatus,
  };
})(BreakoutContainer);
