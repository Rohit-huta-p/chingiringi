import React from 'react';

export interface LocalVideoPreviewProps {
  /** Local blob/object URL of the picked clip. */
  uri: string;
}

/** Web preview of a locally-picked clip with native <video> controls. */
export const LocalVideoPreview: React.FC<LocalVideoPreviewProps> = ({ uri }) => (
  <video
    src={uri}
    controls
    playsInline
    muted
    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
  />
);

export default LocalVideoPreview;
