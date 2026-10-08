# Anatomy of the Kalethra male (left side; the engine mirrors it). Units: metres.
# Views: F(x,z) front ray, B(x,z) back ray, L(y,z) from the side, T(x,y) from above,
#        A(t,theta) arm (t 0..1 upper arm, 1..2 forearm; theta 0 front, 90 lateral, 180 back, 270 medial),
#        G(t,theta) leg (t 0..1 thigh, 1..2 shin).
def build_anatomy(b,S):
    F,B,L,T,A,G,Md=b.F,b.B,b.L,b.T,b.A,b.G,b.M
    # ---------------- chest
    S.sheet('pec_clav',O=[F(0.03,1.45),F(0.08,1.452),F(0.125,1.452)],I=[A(0.24,20),A(0.20,10)],
            M=[F(0.06,1.40),F(0.12,1.405),F(0.17,1.40)],T=0.006,pu=0.6,ps=(0.9,1.3),floor=(0.3,0.3),
            parts=('torso','arm'),label='chest_upper')
    S.sheet('pec_stern',O=[F(0.012,1.44),F(0.012,1.38),F(0.016,1.32),F(0.03,1.285),F(0.07,1.275)],
            I=[A(0.20,10),A(0.15,0),A(0.12,-5),A(0.10,-10),A(0.09,-15)],
            M=[F(0.08,1.39),F(0.09,1.36),F(0.10,1.33),F(0.12,1.31),F(0.145,1.315)],
            T=0.009,pu=0.55,ps=(1.0,1.5),floor=(0.0,0.0),parts=('torso','arm'),label='chest_lower')
    S.groove([F(0.015,1.285),F(0.06,1.276),F(0.10,1.285),F(0.135,1.30),F(0.15,1.32)],depth=0.004,width=0.006,profile=[0.3,1,1,0.8,0.3])
    S.groove([F(0.004,1.44),F(0.004,1.30)],depth=0.002,width=0.006)       # sternal furrow
    S.groove([F(0.128,1.452),F(0.14,1.42),F(0.152,1.37)],depth=0.0025,width=0.005,profile=[0.6,1,0.4])  # deltopectoral
    S.bump(F(0.07,1.458),0.006,0.0018,aniso=((1,0,0.04),4.0))   # clavicle
    S.bump(F(0.14,1.462),0.006,0.0012,aniso=((1,0,0.1),2.5))
    # ---------------- shoulder (deltoid, three heads)
    S.sheet('delt_front',O=[F(0.13,1.452),F(0.165,1.458),T(0.19,0.0)],I=[A(0.40,55),A(0.42,75)],
            M=[A(0.06,10),A(0.08,35),A(0.08,60)],T=0.007,pu=0.5,ps=(0.8,1.6),floor=(0.0,0.45),parts=('torso','arm'),label='shoulders_front')
    S.sheet('delt_mid',O=[T(0.19,0.0),T(0.205,0.02),T(0.20,0.045)],I=[A(0.42,75),A(0.42,105)],
            M=[A(0.05,70),A(0.04,90),A(0.05,115)],T=0.008,pu=0.5,ps=(0.7,1.6),floor=(0.45,0.45),parts=('torso','arm'),label='shoulders_middle')
    S.sheet('delt_rear',O=[T(0.20,0.045),B(0.17,1.43),B(0.13,1.425),B(0.095,1.41)],I=[A(0.42,105),A(0.38,125)],
            M=[A(0.06,130),A(0.08,150),A(0.10,170),B(0.15,1.36)],T=0.006,pu=0.55,ps=(0.9,1.5),floor=(0.45,0.0),parts=('torso','arm'),label='shoulders_rear')
    # ---------------- upper arm
    S.sheet('biceps',O=[('A',0.16,-35),('A',0.14,0),('A',0.16,35)],I=[('A',0.93,-10),('A',0.95,10)],
            M=[('A',0.55,-45),('A',0.55,0),('A',0.55,45)],T=0.0075,pu=0.8,ps=(1.6,1.0),parts=('arm',),label='biceps')
    S.sheet('brachialis',O=[('A',0.45,60),('A',0.50,80)],I=[('A',0.98,35),('A',1.0,55)],T=0.0025,pu=1.0,ps=(1,1),parts=('arm',),label='biceps')
    S.sheet('tri_lat',O=[('A',0.12,115),('A',0.10,160)],I=[('A',0.80,140),('A',0.86,170)],M=[('A',0.45,110),('A',0.45,155)],
            T=0.006,pu=0.6,ps=(1.1,1.0),floor=(0.0,0.4),parts=('arm',),label='triceps')
    S.sheet('tri_long',O=[('A',0.06,185),('A',0.08,230)],I=[('A',0.86,185),('A',0.80,215)],M=[('A',0.45,190),('A',0.45,240)],
            T=0.0065,pu=0.6,ps=(1.2,1.0),floor=(0.4,0.0),parts=('arm',),label='triceps')
    S.sheet('tri_med',O=[('A',0.55,230),('A',0.55,262)],I=[('A',0.97,200),('A',0.97,235)],T=0.003,pu=0.9,ps=(1,1),parts=('arm',),label='triceps')
    S.groove([('A',0.80,165),('A',0.92,178),('A',0.99,180)],depth=0.0015,width=0.009)   # triceps tendon plate
    S.groove([('A',0.55,100),('A',0.75,95),('A',0.95,92)],depth=0.0015,width=0.004)    # lateral intermuscular septum
    S.groove([('A',0.30,268),('A',0.60,272),('A',0.92,268)],depth=0.0009,width=0.005)  # medial bicipital groove
    S.bump(A(1.0,180),0.008,0.002)  # olecranon
    # ---------------- forearm (neutral: thumb forward, palm to the thigh)
    S.sheet('brachiorad',O=[('A',0.70,70),('A',0.76,45)],I=[('A',1.80,15),('A',1.85,-5)],M=[('A',1.20,60),('A',1.22,25)],
            T=0.006,pu=0.7,ps=(0.8,1.8),parts=('arm',),label='forearms_extensors')
    S.sheet('ecrl',O=[('A',0.86,95),('A',1.0,110)],I=[('A',1.70,55),('A',1.75,80)],T=0.004,pu=0.8,ps=(0.8,1.8),parts=('arm',),label='forearms_extensors')
    S.sheet('extensors',O=[('A',1.02,115),('A',1.04,150)],I=[('A',1.85,95),('A',1.85,150)],M=[('A',1.35,105),('A',1.35,160)],
            T=0.0045,pu=0.8,ps=(0.8,2.0),parts=('arm',),label='forearms_extensors')
    S.sheet('flexors',O=[('A',0.99,255),('A',1.02,300)],I=[('A',1.85,240),('A',1.85,330)],M=[('A',1.3,235),('A',1.3,320)],
            T=0.0055,pu=0.8,ps=(0.7,2.0),parts=('arm',),label='forearms_flexors')
    S.sheet('pronator',O=[('A',0.98,295),('A',1.0,315)],I=[('A',1.40,370),('A',1.45,390)],T=0.003,pu=1,ps=(1,1),parts=('arm',),label='forearms_flexors')
    S.groove([('A',1.08,180),('A',1.5,190),('A',1.92,200)],depth=0.0008,width=0.005)  # ulna line
    # ---------------- back
    S.sheet('trap_up',O=[B(0.012,1.64),B(0.015,1.56),B(0.008,1.50)],I=[T(0.13,0.01),T(0.17,0.025),T(0.195,0.04)],
            T=0.007,pu=0.7,ps=(1.0,1.2),floor=(0.0,0.4),parts=('torso',),label='back_trapezius')
    S.sheet('trap_mid',O=[B(0.006,1.50),B(0.006,1.40)],I=[B(0.19,1.44),B(0.09,1.41)],T=0.0045,pu=0.9,ps=(1.0,1.0),soft=0.009,
            floor=(0.4,0.4),parts=('torso',),label='back_trapezius')
    S.sheet('trap_low',O=[B(0.006,1.40),B(0.006,1.16)],I=[B(0.095,1.405),B(0.085,1.395)],T=0.003,pu=0.9,ps=(1.0,1.0),soft=0.01,
            floor=(0.4,0.0),parts=('torso',),label='back_trapezius')
    S.sheet('rhomboid',O=[B(0.01,1.47),B(0.01,1.30)],I=[B(0.075,1.42),B(0.09,1.27)],T=0.0025,pu=0.9,parts=('torso',),label='back_rhomboids',fib=0.0002)
    S.sheet('infraspin',O=[B(0.085,1.39),B(0.095,1.28)],I=[B(0.19,1.405),B(0.185,1.375)],M=[B(0.14,1.37),B(0.14,1.31)],
            T=0.0045,pu=0.7,parts=('torso',),label='back_rhomboids')
    S.sheet('teres_maj',O=[B(0.095,1.30),B(0.10,1.26)],I=[A(0.14,215),A(0.12,240)],M=[B(0.14,1.30),B(0.15,1.29)],
            T=0.006,pu=0.8,parts=('torso','arm'),label='lats')
    S.sheet('lats',O=[B(0.025,1.25),B(0.04,1.12),B(0.07,1.02),L(0.07,1.00),L(0.04,1.02)],
            I=[B(0.14,1.32),B(0.155,1.31),L(0.10,1.30),L(0.08,1.30),L(0.06,1.30)],
            M=[B(0.10,1.25),B(0.125,1.18),L(0.105,1.14),L(0.08,1.13),L(0.055,1.14)],
            T=0.0075,pu=0.7,ps=(1.8,1.0),soft=0.009,parts=('torso',),label='lats')
    S.sheet('lats_arm',O=[B(0.14,1.32),L(0.10,1.30),L(0.06,1.30)],I=[A(0.12,215),A(0.11,250),A(0.10,280)],
            T=0.005,pu=0.8,ps=(0.9,1.2),soft=0.008,parts=('torso','arm'),label='lats')
    S.sheet('erector',O=[B(0.012,0.975),B(0.068,0.99)],I=[B(0.015,1.34),B(0.045,1.34)],M=[B(0.014,1.12),B(0.075,1.12)],
            T=0.0065,pu=0.55,ps=(0.6,2.4),floor=(0.0,0.0),soft=0.011,parts=('torso',),label='back_erectors')
    S.groove([B(0.0,1.52),B(0.0,1.30),B(0.0,1.10),B(0.0,0.99)],depth=0.002,width=0.007,profile=[0.3,0.8,0.7,0.1])
    S.groove([B(0.085,1.43),B(0.10,1.35),B(0.11,1.28),B(0.12,1.255)],depth=0.0009,width=0.008)   # scapula medial border
    S.groove([B(0.09,1.415),B(0.15,1.425),B(0.19,1.432)],depth=0.0012,width=0.004)               # below the scapular spine
    S.bump(B(0.0,1.50),0.008,0.002)  # C7
    # ---------------- abdomen
    S.sheet('rectus',O=[F(0.008,0.93),F(0.035,0.93)],I=[F(0.008,1.29),F(0.085,1.275)],M=[F(0.008,1.10),F(0.07,1.10)],
            T=0.0055,pu=0.55,ps=(0.4,0.3),floor=(0.3,0.0),parts=('torso',),label='core_rectus',fib=0.00015)
    for z,dep in ((1.055,0.0016),(1.135,0.0021),(1.215,0.0019)):
        S.groove([F(0.0,z+0.004),F(0.04,z),F(0.075,z+0.006)],depth=dep,width=0.0045,profile=[0.5,1,0.7])
    S.groove([F(0.0,1.28),F(0.0,1.06),F(0.0,0.97)],depth=0.0024,width=0.0045,profile=[1,1,0.3])   # linea alba
    S.groove([F(0.085,1.26),F(0.08,1.15),F(0.072,1.06),F(0.05,0.96)],depth=0.0018,width=0.006)    # linea semilunaris
    S.bump(F(0.0,1.05),0.007,-0.006)  # navel
    S.bump(F(0.0,1.058),0.006,0.0015)
    S.sheet('obl_ext',O=[F(0.115,1.255),L(-0.05,1.19),L(-0.01,1.12),L(0.02,1.06),L(0.035,1.02)],
            I=[F(0.09,1.22),F(0.085,1.13),F(0.085,1.05),F(0.095,0.99),F(0.11,0.975)],
            T=0.0055,pu=0.7,ps=(1.0,0.8),floor=(0.0,0.3),parts=('torso',),label='core_obliques')
    for i,z in enumerate((1.295,1.262,1.228,1.196)):   # serratus anterior digitations
        S.sheet(f'serratus{i}',O=[L(-0.072+0.004*i,z-0.008),L(-0.072+0.004*i,z+0.008)],I=[L(0.02,z+0.05),L(0.02,z+0.06)],
                T=0.0028,pu=0.8,ps=(0.6,1.5),soft=0.004,parts=('torso',),label='core_obliques',fib=0.0002,spacing=0.004)
        S.groove([L(-0.075+0.004*i,z-0.016),L(-0.02,z-0.006),L(0.015,z+0.03)],depth=0.0012,width=0.003)
    S.groove([L(0.05,1.01),L(-0.02,0.995),F(0.11,0.975),F(0.07,0.92),F(0.035,0.885)],depth=0.0018,width=0.008,profile=[0.0,0.5,1,0.8,0.2])  # iliac crest / inguinal
    # ---------------- neck
    S.sheet('scm',O=[L(0.02,1.605,'head'),L(0.0,1.60,'head')],I=[F(0.015,1.46),F(0.04,1.462)],M=[F(0.045,1.54),F(0.055,1.54)],
            T=0.003,pu=1.0,ps=(1.6,1.0),soft=0.010,parts=('torso','head'),fib=0.0002,label=None)
    S.bump(F(0.0,1.515,'torso'),0.008,0.0025,aniso=((0,0,1),1.6))  # larynx
    # ---------------- hips and legs
    S.sheet('glute_max',O=[B(0.012,0.97),B(0.05,1.0),B(0.10,0.995),L(0.06,0.96)],I=[B(0.03,0.80),B(0.10,0.79),L(0.04,0.80),L(0.03,0.84)],
            T=0.0065,pu=0.6,ps=(1.0,0.9),parts=('torso','leg'),label='glutes_maximus')
    S.sheet('glute_med',O=[L(0.0,1.0),L(0.05,0.99)],I=[L(0.0,0.87),L(0.03,0.87)],T=0.004,pu=0.7,parts=('torso','leg'),label='glutes_medius')
    S.groove([B(0.02,0.815),B(0.07,0.79),B(0.12,0.80),B(0.14,0.815)],depth=0.003,width=0.006,profile=[0.3,1,0.8,0.2])   # gluteal fold
    S.groove([L(0.025,0.86),L(0.0,0.84)],depth=0.002,width=0.01)   # trochanteric hollow
    S.sheet('rect_fem',O=[('G',0.06,-10),('G',0.05,15)],I=[('G',0.88,-5),('G',0.88,10)],T=0.0055,pu=0.7,ps=(1.0,1.3),parts=('leg',),label='quadriceps')
    S.sheet('vast_lat',O=[('G',0.10,40),('G',0.08,110)],I=[('G',0.90,30),('G',0.85,95)],M=[('G',0.5,45),('G',0.5,115)],T=0.006,pu=0.7,ps=(1.0,1.1),parts=('leg',),label='quadriceps')
    S.sheet('vast_med',O=[('G',0.40,-30),('G',0.45,-70)],I=[('G',0.90,-25),('G',0.92,-55)],M=[('G',0.72,-35),('G',0.75,-75)],T=0.0065,pu=0.7,ps=(1.8,0.9),parts=('leg',),label='quadriceps')
    S.groove([F(0.10,0.93,'leg'),G(0.30,-30),G(0.6,-70),G(0.95,-105)],depth=0.0018,width=0.005)   # sartorius line
    S.groove([('G',0.35,100),('G',0.65,105),('G',0.92,110)],depth=0.0015,width=0.006)   # IT band edge
    S.sheet('adductors',O=[('G',0.05,-90),('G',0.06,-130)],I=[('G',0.65,-110),('G',0.75,-140)],T=0.004,pu=0.8,parts=('leg',),label='adductors')
    S.sheet('hamstr_lat',O=[('G',0.12,165),('G',0.12,190)],I=[('G',0.95,135),('G',0.97,155)],T=0.0055,pu=0.8,ps=(1.2,1.0),parts=('leg',),label='hamstrings')
    S.sheet('hamstr_med',O=[('G',0.12,195),('G',0.12,215)],I=[('G',0.95,215),('G',0.97,240)],T=0.0055,pu=0.8,ps=(1.2,1.0),parts=('leg',),label='hamstrings')
    S.groove([('G',0.55,190),('G',0.80,188),('G',0.98,185)],depth=0.0018,width=0.006)   # popliteal split of the hamstrings
    S.bump(G(0.97,0),0.016,0.0025,aniso=((0,0,1),1.25))   # patella
    S.groove([('G',0.90,-40),('G',0.97,-50),('G',1.04,-30)],depth=0.0015,width=0.006)
    S.sheet('gastro_med',O=[('G',1.04,200),('G',1.04,240)],I=[('G',1.55,185),('G',1.58,200)],M=[('G',1.25,205),('G',1.25,255)],T=0.008,pu=0.7,ps=(0.8,1.4),parts=('leg',),label='calves_gastrocnemius')
    S.sheet('gastro_lat',O=[('G',1.04,140),('G',1.04,175)],I=[('G',1.50,170),('G',1.52,180)],M=[('G',1.22,130),('G',1.22,175)],T=0.006,pu=0.7,ps=(0.8,1.4),parts=('leg',),label='calves_gastrocnemius')
    S.sheet('soleus',O=[('G',1.28,110),('G',1.28,250)],I=[('G',1.70,160),('G',1.72,200)],T=0.003,pu=0.6,ps=(1,1),parts=('leg',),label='calves_soleus',fib=0.0002)
    S.sheet('tib_ant',O=[('G',1.06,35),('G',1.08,60)],I=[('G',1.80,10),('G',1.85,25)],T=0.004,pu=0.8,ps=(0.8,1.6),parts=('leg',),label=None)
    S.groove([('G',1.05,15),('G',1.5,5),('G',1.85,-5)],depth=0.0012,width=0.004)   # shin crest

    # ---------------- bony landmarks at elbow and knee (iteration 3)
    S.bump(('A',1.0,110),0.007,0.0018)    # lateral epicondyle
    S.bump(('A',0.98,265),0.008,0.0022)   # medial epicondyle
    S.bump(('A',1.02,10),0.012,-0.0015)   # cubital fossa
    S.bump(('G',1.06,5),0.010,0.002,aniso=((0,0,1),1.4))   # tibial tuberosity
    S.groove([('G',0.92,-60),('G',1.0,-80),('G',1.06,-60)],depth=0.0012,width=0.006)   # medial knee
    S.groove([('G',0.92,70),('G',1.0,80),('G',1.06,70)],depth=0.0012,width=0.006)      # lateral knee
    build_hand(b,S)
    build_head(b,S)

def build_head(b,S):
    """Reduced, sculptural face: brow, sockets, nose, cheekbones, mouth/chin, jaw line, ears."""
    import numpy as np
    F,L=b.F,b.L
    sd=b.side
    if sd>0:   # centre-line features once
        S.bump(F(0.0,1.665,'head'),0.010,0.003,aniso=((1,0,0),3.0))            # glabella / brow band
        S.bump(F(0.0,1.640,'head'),0.006,0.004,aniso=((0,0,1),2.6))            # nasal bridge
        S.bump(F(0.0,1.615,'head'),0.010,0.012,aniso=((0,0,1),1.3))            # nose
        S.bump(F(0.0,1.603,'head'),0.006,0.004)                                 # tip
        S.groove([F(0.0,1.597,'head'),F(0.0,1.585,'head')],depth=0.0015,width=0.003)  # philtrum
        S.bump(F(0.0,1.581,'head'),0.008,0.0025,aniso=((1,0,0),2.6))           # upper lip
        S.groove([F(-0.02,1.574,'head'),F(0.0,1.5735,'head'),F(0.02,1.574,'head')],depth=0.0016,width=0.0022)   # mouth line
        S.bump(F(0.0,1.566,'head'),0.008,0.0025,aniso=((1,0,0),2.2))           # lower lip
        S.groove([F(-0.015,1.559,'head'),F(0.015,1.559,'head')],depth=0.0015,width=0.004)   # mentolabial sulcus
        S.bump(F(0.0,1.549,'head'),0.012,0.003,aniso=((1,0,0),1.6))            # chin
    S.bump(F(0.016,1.607,'head'),0.006,0.004)                                   # nose wing
    S.bump(F(0.032,1.668,'head'),0.010,0.003,aniso=((1,0,0.15),2.2))           # brow ridge
    S.bump(F(0.033,1.645,'head'),0.013,-0.0055,aniso=((1,0,0),1.35))           # eye socket
    S.bump(F(0.031,1.646,'head'),0.008,0.002,aniso=((1,0,0),1.4))              # closed eyelid volume
    S.bump(F(0.052,1.628,'head'),0.013,0.0035,aniso=((1,0,0.3),1.6))           # cheekbone
    S.bump(F(0.040,1.600,'head'),0.016,-0.0025)                                 # cheek plane below the zygoma
    S.bump(F(0.058,1.570,'head'),0.014,0.003)                                   # jaw angle (masseter)
    # jaw line: the base head is a block under the face; everything below the mandible border
    # (chin -> jaw angle, rising backwards) recedes towards the neck
    P,N=b.P,b.N
    zm=1.548+0.32*(P[:,1]+0.10)
    m=(b.part==5)&(sd>0)&(P[:,2]>1.49)&(P[:,2]<zm)&(P[:,1]>-0.12)&(P[:,1]<0.035)
    if m.any():
        depth=0.009*np.clip((zm[m]-P[m,2])/0.012,0,1)**0.8
        depth*=np.clip((P[m,2]-1.49)/0.03,0,1)                       # fades into the neck
        depth*=np.clip((0.035-P[m,1])/0.03,0,1)                      # and towards the ear
        S.H[m]-=depth
    # ear: stylised relief (helix rim, concha, lobe)
    S.bump(L(0.015,1.625,'head'),0.016,0.0045,aniso=((0,0.25,1),1.7))
    S.groove([L(0.006,1.652,'head'),L(0.022,1.656,'head'),L(0.033,1.643,'head'),L(0.036,1.622,'head'),L(0.030,1.603,'head'),L(0.020,1.595,'head')],
             depth=-0.0035,width=0.0028)
    S.bump(L(0.016,1.622,'head'),0.008,-0.004,aniso=((0,0.2,1),1.5))           # concha
    S.bump(L(0.014,1.593,'head'),0.006,0.002)                                   # lobe
    S.bump(L(-0.002,1.618,'head'),0.004,0.002)                                  # tragus

def build_hand(b,S):
    """Knuckles, finger joints and nail plates on the curled hand (landmarks from stage 3)."""
    import numpy as np
    if HAND is None: return
    sx=np.array([b.side,1,1.0])
    pn=np.array(HAND['palm_normal'])*sx; dorsal=-pn
    for k,f in enumerate(HAND['fingers']):
        mcp,pip,dip,tip=[(np.array(p)+np.array([0.012,0,0]))*sx for p in f]   # +stage 3b shoulder shift
        r=0.0085 if k<3 else 0.0075
        knuckle=mcp+(pip-mcp)*0.35+dorsal*0.012
        S.bump(knuckle,0.0065,0.0018)                   # knuckle (metacarpal head)
        S.bump(pip+dorsal*0.008,0.0055,0.0016)          # PIP joint
        S.bump(dip+dorsal*0.007,0.0045,0.0008)          # DIP joint
        S.bump(pip-dorsal*0.008,0.006,-0.0008)          # palmar crease
        nail=tip+(dip-tip)*0.35+dorsal*0.007
        S.bump(nail,0.0045,0.0007,aniso=(tuple((dip-tip)/np.linalg.norm(dip-tip)),1.4))   # nail plate
        S.groove([nail+(tip-dip)*0.25,nail+(tip-dip)*0.25+np.cross(dorsal,(dip-tip))*1.0],depth=0.0003,width=0.0012)
