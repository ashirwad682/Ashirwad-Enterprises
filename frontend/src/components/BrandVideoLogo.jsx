import React, { forwardRef } from 'react'

const BRAND_LOGO_SRC = '/images/ASHIRWAD ENTERPRISES LOGO .mp4'

const BrandVideoLogo = forwardRef(function BrandVideoLogo({
  size = 72,
  style,
  className,
  muted = true,
  loop = true,
  autoPlay = true,
  playsInline = true,
  ...rest
}, ref) {
  const resolvedSize = typeof size === 'number' ? `${size}px` : size

  return (
    <video
      ref={ref}
      src={BRAND_LOGO_SRC}
      autoPlay={autoPlay}
      loop={loop}
      muted={muted}
      playsInline={playsInline}
      aria-label="Ashirwad Enterprises animated logo"
      className={className}
      style={{
        width: resolvedSize,
        height: 'auto',
        maxWidth: '100%',
        maxHeight: resolvedSize,
        objectFit: 'contain',
        display: 'block',
        borderRadius: 16,
        ...style
      }}
      {...rest}
    />
  )
})

export default BrandVideoLogo
