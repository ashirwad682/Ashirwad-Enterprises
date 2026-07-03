import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMediaQuery } from '../lib/useMediaQuery'

export default function ChatAssistance() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ticketId = searchParams.get('ticket')
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const style = document.createElement('style')
    style.innerHTML = `
      @keyframes festivePulse {
        0%, 100% { transform: scale(1); opacity: 0.8; }
        50% { transform: scale(1.05); opacity: 1; }
      }
      .festive-pulse {
        animation: festivePulse 3s ease-in-out infinite;
      }
    `
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  useEffect(() => {
    if (ticketId) {
      const storedTicket = localStorage.getItem(`ticket_${ticketId}`)
      if (storedTicket) {
        const ticketData = JSON.parse(storedTicket)
        setTicket(ticketData)
        
        // Initialize with welcome messages
        const initialMessages = [
          {
            id: 1,
            type: 'system',
            text: `Thank you for raising a case. Our AI assistant is reviewing your details. A support manager will be with you shortly.`,
            timestamp: new Date().toISOString()
          },
          {
            id: 2,
            type: 'bot',
            sender: 'AI Assistant',
            text: `I placed order #9920 last week and it still shows as "Processing". Need this urgently for the festival season.`,
            timestamp: new Date(Date.now() + 2000).toISOString()
          },
          {
            id: 3,
            type: 'agent',
            sender: 'Priya Sharma',
            role: 'Support Manager',
            text: `Namaste! I apologize for the delay. I can see the order #9920 in our system. Let me check the dispatch status with our warehouse team immediately.`,
            timestamp: new Date(Date.now() + 4000).toISOString()
          }
        ]
        setMessages(initialMessages)
      } else {
        // No ticket found, redirect to create ticket
        navigate('/support/ticket')
      }
    }
  }, [ticketId, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!inputMessage.trim()) return

    const newMessage = {
      id: messages.length + 1,
      type: 'user',
      text: inputMessage,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, newMessage])
    setInputMessage('')
    setIsTyping(true)

    // Simulate agent response
    setTimeout(() => {
      setIsTyping(false)
      const agentResponse = {
        id: messages.length + 2,
        type: 'agent',
        sender: 'Priya Sharma',
        role: 'Support Manager',
        text: getAutoResponse(inputMessage),
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, agentResponse])
    }, 2000)
  }

  const getAutoResponse = (message) => {
    const lowerMsg = message.toLowerCase()
    if (lowerMsg.includes('urgent') || lowerMsg.includes('asap')) {
      return "I understand the urgency. I've escalated this to our dispatch team. You should receive an update within the next 30 minutes."
    } else if (lowerMsg.includes('refund') || lowerMsg.includes('cancel')) {
      return "I can help you with that. Let me process the refund request. You'll receive confirmation via email within 24 hours."
    } else if (lowerMsg.includes('thank')) {
      return "You're welcome! Is there anything else I can help you with today? 😊"
    }
    return "Thank you for the information. I'm working on this and will update you shortly. Our team is committed to resolving this within 24 hours."
  }

  if (!ticket) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#fff' }}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: 72, marginBottom: 20 }}>🎫</div>
          <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 16, color: 'var(--text-primary)' }}>Loading Ticket...</h2>
          <button
            onClick={() => navigate('/support/ticket')}
            className="btn"
            style={{ marginTop: 24, padding: '14px 32px', fontSize: 16, fontWeight: 700 }}
          >
            Create New Ticket
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', paddingTop: 80, position: 'relative', overflow: 'hidden' }}>
      {/* Festive Color Patches - Background */}
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        animate={{ opacity: 0.06, scale: 1 }} 
        transition={{ duration: 1.2, delay: 0.2 }}
        className="festive-pulse"
        style={{ position: 'fixed', top: '8%', left: '4%', width: isMobile ? '140px' : '240px', height: isMobile ? '140px' : '240px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255, 103, 31, 0.9), rgba(255, 103, 31, 0))', filter: 'blur(50px)', zIndex: 0, pointerEvents: 'none' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        animate={{ opacity: 0.08, scale: 1 }} 
        transition={{ duration: 1.2, delay: 0.4 }}
        className="festive-pulse"
        style={{ position: 'fixed', bottom: '15%', right: '6%', width: isMobile ? '160px' : '260px', height: isMobile ? '160px' : '260px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(4, 106, 56, 0.9), rgba(4, 106, 56, 0))', filter: 'blur(55px)', zIndex: 0, pointerEvents: 'none', animationDelay: '0.5s' }} 
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0 }} 
        animate={{ opacity: 0.07, scale: 1 }} 
        transition={{ duration: 1.2, delay: 0.6 }}
        className="festive-pulse"
        style={{ position: 'fixed', top: '45%', right: '8%', width: isMobile ? '120px' : '200px', height: isMobile ? '120px' : '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(249, 178, 61, 0.9), rgba(249, 178, 61, 0))', filter: 'blur(45px)', zIndex: 0, pointerEvents: 'none', animationDelay: '1s' }} 
      />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: isMobile ? '20px' : '40px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '400px 1fr', gap: 24, height: 'calc(100vh - 160px)' }}>
          
          {/* Left Panel - Ticket Details */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            style={{ background: '#fff', borderRadius: 24, padding: isMobile ? '28px' : '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '2px solid rgba(0,0,0,0.06)', overflowY: 'auto' }}
          >
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>Create Support Ticket</h2>
                <button
                  onClick={() => navigate('/support/ticket')}
                  style={{ padding: '8px 16px', borderRadius: 10, border: '2px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#6366f1', transition: 'all 0.3s ease' }}
                  onMouseEnter={(e) => { e.target.style.background = 'rgba(99,102,241,0.1)'; e.target.style.borderColor = '#6366f1' }}
                  onMouseLeave={(e) => { e.target.style.background = 'rgba(99,102,241,0.05)'; e.target.style.borderColor = 'rgba(99,102,241,0.3)' }}
                >
                  + New
                </button>
              </div>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Hi Distributor, fill in the details below to get assistance with your orders or account.
              </p>
            </div>

            {/* Ticket Info */}
            <div style={{ display: 'grid', gap: 24 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>Ticket ID</div>
                <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(4,106,56,0.1)', border: '2px solid rgba(4,106,56,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-green)' }}>{ticketId}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(ticketId); alert('Copied!') }}
                    style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--brand-green)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(4,106,56,0.3)', transition: 'all 0.3s ease' }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Subject</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>{ticket.subject}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category</div>
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', fontSize: 14, fontWeight: 700, border: '1px solid rgba(99,102,241,0.15)' }}>
                    {ticket.category}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Priority</div>
                  <div style={{ 
                    padding: '10px 14px', 
                    borderRadius: 10, 
                    background: ticket.priority === 'Urgent' ? 'rgba(255,103,31,0.12)' : 'rgba(249,178,61,0.12)', 
                    fontSize: 14, 
                    fontWeight: 800,
                    color: ticket.priority === 'Urgent' ? 'var(--brand-saffron)' : 'var(--brand-amber)',
                    border: ticket.priority === 'Urgent' ? '1px solid rgba(255,103,31,0.25)' : '1px solid rgba(249,178,61,0.25)'
                  }}>
                    {ticket.priority}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</div>
                <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(4,106,56,0.1)', fontSize: 14, fontWeight: 800, color: 'var(--brand-green)', display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid rgba(4,106,56,0.2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-green)' }} />
                  {ticket.status}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</div>
                <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(0,0,0,0.02)', fontSize: 15, lineHeight: 1.8, color: 'var(--text-secondary)', border: '1px solid rgba(0,0,0,0.05)' }}>
                  {ticket.description}
                </div>
              </div>

              {ticket.agentActive && (
                <div style={{ padding: '18px', borderRadius: 14, background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(236,72,153,0.12))', border: '2px solid rgba(99,102,241,0.25)', boxShadow: '0 4px 16px rgba(99,102,241,0.15)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s ease-in-out infinite', boxShadow: '0 0 12px rgba(34, 197, 94, 0.5)' }} />
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>● Agent Active</div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    A support manager is actively working on your case.
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Panel - Chat */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{ background: '#fff', borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '2px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Chat Header */}
            <div style={{ padding: '24px 28px', borderBottom: '2px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '-0.01em' }}>
                    Delivery Issue: Order #{ticketId.split('-')[2]} Pending
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    💬 Live Chat Support
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>TODAY</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <div style={{ display: 'grid', gap: 16 }}>
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isTyping && (
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--brand-saffron)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 15, fontWeight: 800, flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                      PS
                    </div>
                    <div style={{ padding: '16px 20px', borderRadius: '20px 20px 20px 4px', background: '#fff', maxWidth: '70%', border: '2px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-saffron)', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0s' }} />
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-saffron)', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }} />
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--brand-saffron)', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} style={{ padding: '24px 28px', borderTop: '2px solid rgba(0,0,0,0.06)', background: 'rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <button type="button" style={{ padding: '12px', borderRadius: 12, border: '2px solid rgba(0,0,0,0.08)', background: '#fff', cursor: 'pointer', fontSize: 20, transition: 'all 0.3s ease' }}
                  onMouseEnter={(e) => { e.target.style.borderColor = 'var(--brand-saffron)'; e.target.style.background = 'rgba(255,103,31,0.05)' }}
                  onMouseLeave={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.background = '#fff' }}
                >
                  📎
                </button>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  style={{ flex: 1, padding: '14px 18px', borderRadius: 12, border: '2px solid rgba(0,0,0,0.08)', fontSize: 16, outline: 'none', background: '#fff', transition: 'all 0.3s ease' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--brand-saffron)'; e.target.style.boxShadow = '0 4px 16px rgba(255,103,31,0.15)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: '50%',
                    border: 'none',
                    background: inputMessage.trim() ? 'linear-gradient(135deg, #6366f1, #ec4899)' : 'rgba(0,0,0,0.1)',
                    color: '#fff',
                    fontSize: 22,
                    cursor: inputMessage.trim() ? 'pointer' : 'not-allowed',
                    display: 'grid',
                    placeItems: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: inputMessage.trim() ? '0 8px 24px rgba(99,102,241,0.35)' : 'none'
                  }}
                  onMouseEnter={(e) => { if (inputMessage.trim()) e.target.style.transform = 'scale(1.1)' }}
                  onMouseLeave={(e) => { e.target.style.transform = 'scale(1)' }}
                >
                  ➤
                </button>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, fontWeight: 600 }}>Press Enter to send</div>
            </form>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

function MessageBubble({ message }) {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  if (message.type === 'system') {
    return (
      <div style={{ textAlign: 'center', padding: '16px 28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 24px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', border: '2px solid rgba(99,102,241,0.25)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', boxShadow: '0 4px 16px rgba(99,102,241,0.15)' }}>
          <span>🤖</span>
          {message.text}
        </div>
      </div>
    )
  }

  if (message.type === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ maxWidth: '70%' }}>
          <div style={{ padding: '14px 20px', borderRadius: '20px 20px 4px 20px', background: 'linear-gradient(135deg, #6366f1, #ec4899)', color: '#fff', fontSize: 16, lineHeight: 1.7, boxShadow: '0 8px 24px rgba(99,102,241,0.25)' }}>
            {message.text}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right', fontWeight: 600 }}>
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    )
  }

  // Agent or bot message
  return (
    <div style={{ display: 'flex', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: message.type === 'bot' ? 'var(--brand-green)' : 'var(--brand-saffron)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: 15, fontWeight: 800, flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
        {message.type === 'bot' ? '🤖' : message.sender?.split(' ').map(n => n[0]).join('')}
      </div>
      <div style={{ maxWidth: '70%' }}>
        {message.sender && (
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
            {message.sender}
            {message.role && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 8 }}>• {message.role}</span>}
          </div>
        )}
        <div style={{ padding: '14px 20px', borderRadius: '20px 20px 20px 4px', background: '#fff', border: '2px solid rgba(0,0,0,0.06)', fontSize: 16, lineHeight: 1.7, color: 'var(--text-secondary)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
          {message.text}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, fontWeight: 600 }}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  )
}
