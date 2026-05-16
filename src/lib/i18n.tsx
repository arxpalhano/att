"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Lang = "pt" | "en" | "es" | "fr";

// ─── Translations ─────────────────────────────────────────────────────────────
const translations: Record<Lang, Record<string, string>> = {
  pt: {
    "nav.howItWorks": "Como funciona",
    "nav.benefits": "Benefícios",
    "nav.plans": "Planos",
    "nav.clients": "Clientes",
    "nav.login": "Entrar",
    "nav.startNow": "Começar agora",

    "hero.badge": "Mais de 500 marcas de móveis e design já na plataforma",
    "hero.title1": "Seu produto em 3D interativo",
    "hero.title2": "e Realidade Aumentada —",
    "hero.title3": "para arquitetos do mundo todo",
    "hero.subtitle": "Transformamos catálogos de móveis e revestimentos em experiências digitais imersivas. Seu cliente vê, personaliza e especifica — sem sair do lugar.",
    "hero.seePlans": "Ver planos e preços",
    "hero.seeDemo": "Ver demo",
    "hero.noApp": "Sem app para instalar",
    "hero.delivery": "Entrega em até 7 dias úteis",
    "hero.noContract": "Sem contrato de fidelidade",

    "transformation.label": "A transformação",
    "transformation.title": "Do arquivo ao produto interativo em dias",
    "transformation.youSend": "Você envia",
    "transformation.weDeliver": "A gente entrega",
    "transformation.avgTime": "Prazo médio: 7 dias úteis",
    "transformation.footer": "Do arquivo do cliente ao produto interativo em Realidade Aumentada",

    "send.jpg": "Fotos do produto",
    "send.skp": "Arquivo CAD / SketchUp",
    "send.pdf": "Caderno de acabamentos",
    "send.dwg": "Fichas técnicas",

    "deliver.model": "Modelo 3D interativo",
    "deliver.model.desc": "Navegável no browser, sem app",
    "deliver.customizer": "Customizador de acabamentos",
    "deliver.customizer.desc": "Cores e materiais em tempo real",
    "deliver.ar": "Realidade Aumentada",
    "deliver.ar.desc": "QR code → produto em escala real",
    "deliver.global": "Publicação global",
    "deliver.global.desc": "Visível para arquitetos em 40+ países",
    "deliver.analytics": "Analytics de uso",
    "deliver.analytics.desc": "Veja quem especificou seu produto",

    "numbers.countries": "países alcançados",
    "numbers.brands": "marcas na plataforma",
    "numbers.downloads": "downloads por mês",
    "numbers.delivery": "prazo médio de entrega",

    "howItWorks.label": "Como funciona",
    "howItWorks.title": "Simples para você. Impressionante para seu cliente.",
    "howItWorks.subtitle": "Você não precisa saber nada de 3D. É só enviar seus materiais — cuidamos de todo o resto.",

    "steps.s1.title": "Você envia os arquivos",
    "steps.s1.desc": "Fotos do produto, arquivos CAD, fichas técnicas e catálogo de acabamentos — tudo pelo portal, no seu tempo.",
    "steps.s2.title": "A gente transforma em 3D",
    "steps.s2.desc": "Nossa equipe modela, texturiza e configura cada produto. Você acompanha o progresso e aprova antes da publicação.",
    "steps.s3.title": "Seu produto chega ao mundo",
    "steps.s3.desc": "Publicado na plataforma com embed para seu site, QR code para RA e visibilidade para arquitetos globalmente.",

    "benefits.label": "Por que a ArchTechTour",
    "benefits.title": "O que muda para a sua marca",

    "benefits.b1.title": "Do projeto ao 3D interativo",
    "benefits.b1.desc": "Envie fotos, CAD ou desenhos técnicos e nossa equipe entrega seu produto como um bloco 3D configurável — sem você precisar tocar em nenhum software.",
    "benefits.b2.title": "Visível para arquitetos do mundo todo",
    "benefits.b2.desc": "Seus produtos ficam disponíveis na plataforma ArchTechTour, usada por profissionais de arquitetura em mais de 40 países para especificar e comprar.",
    "benefits.b3.title": "Realidade Aumentada no bolso do arquiteto",
    "benefits.b3.desc": "Com um QR code, o arquiteto posiciona seu móvel em escala real no ambiente do cliente — direto pelo celular, sem app, sem treinamento.",
    "benefits.b4.title": "Customizador de acabamentos",
    "benefits.b4.desc": "O cliente final escolhe cor, revestimento e material em tempo real no modelo 3D. Você vende mais sem precisar ter todos os acabamentos em estoque.",

    "testimonials.label": "Resultados reais",
    "testimonials.title": "O que dizem nossos clientes",

    "clients.label": "Marcas que já estão no digital 3D",

    "plans.label": "Planos e preços",
    "plans.title": "Comece hoje, sem vendedor",
    "plans.subtitle": "Assine online, pague com Pix ou cartão e inicie o onboarding no mesmo dia.",
    "plans.popular": "Mais popular",
    "plans.startNow": "Começar agora",
    "plans.talkTeam": "Falar com a equipe",
    "plans.perMonth": "/mês",
    "plans.underConsult": "Sob consulta",

    "plans.starter.desc": "Ideal para marcas iniciando no digital 3D.",
    "plans.starter.products": "10 produtos em 3D",
    "plans.pro.desc": "Para catálogos médios com customizador de RA.",
    "plans.pro.products": "50 produtos em 3D",
    "plans.enterprise.desc": "Volume ilimitado com gerente dedicado.",

    "testimonial.1.quote": "Em 3 semanas tínhamos 40 produtos em 3D na plataforma. Arquitetos de São Paulo a Lisboa já estão especificando nossa linha.",
    "testimonial.1.role": "Diretora Comercial · Escal Móveis",
    "testimonial.2.quote": "O customizador de RA virou nosso principal argumento de venda. O cliente vê o sofá na sala dele antes de comprar.",
    "testimonial.2.role": "CEO · Estúdio Bola",
    "testimonial.3.quote": "Reduzimos o ciclo de vendas B2B pela metade. Arquitetos especificam nossos produtos sem precisar visitar o showroom.",
    "testimonial.3.role": "Gerente de Marketing · Tidelli",

    "plans.f1": "Portal de acompanhamento",
    "plans.f2": "Aprovação online",
    "plans.f3": "NF-e automática",
    "plans.f4": "Suporte por e-mail",
    "plans.f5": "Customizador de RA",
    "plans.f6": "Variações de acabamento",
    "plans.f7": "Analytics avançado",
    "plans.f8": "Suporte prioritário",
    "plans.f9": "Gerente de conta dedicado",
    "plans.f10": "SLA garantido em contrato",
    "plans.f11": "Integração personalizada",
    "plans.f12": "Relatórios executivos",
    "plans.f13": "NF-e e Invoice internacional",
    "plans.f14": "Produtos ilimitados",

    "cta.badge": "Primeiros blocos entregues em até 7 dias úteis",
    "cta.title1": "Pronto para levar seu catálogo ao",
    "cta.title2": "mundo digital 3D?",
    "cta.subtitle": "Escolha seu plano, assine em minutos e comece o onboarding hoje — sem vendedor, sem reunião obrigatória.",
    "cta.seePlans": "Ver planos",
    "cta.talkTeam": "Falar com a equipe",

    "footer.tagline": "3D & RA para marcas de design",
    "footer.terms": "Termos de uso",
    "footer.privacy": "Privacidade",

    "video.title": "Vídeo em produção",
    "video.desc": "Estamos produzindo um vídeo mostrando a transformação completa — do projeto ao 3D interativo com Realidade Aumentada.",
    "video.requestDemo": "Solicitar demo ao vivo",

    "portal.title": "Analytics",
    "portal.refresh": "Atualizar",
    "portal.users": "Usuários únicos",
    "portal.sessions": "Sessões",
    "portal.events": "Eventos",
    "portal.products": "Produtos engajados",
    "portal.loading": "Carregando...",
    "portal.noData": "Sem dados para o período",
    "portal.selectClient": "Selecionar cliente",
    "portal.selectPeriod": "Período",
    "portal.apply": "Aplicar",
    "portal.logout": "Sair",
  },
  en: {
    "nav.howItWorks": "How it works",
    "nav.benefits": "Benefits",
    "nav.plans": "Plans",
    "nav.clients": "Clients",
    "nav.login": "Login",
    "nav.startNow": "Get started",

    "hero.badge": "500+ furniture and design brands on the platform",
    "hero.title1": "Your product in interactive 3D",
    "hero.title2": "and Augmented Reality —",
    "hero.title3": "for architects worldwide",
    "hero.subtitle": "We transform furniture and cladding catalogs into immersive digital experiences. Your client sees, customizes and specifies — without leaving their place.",
    "hero.seePlans": "See plans & pricing",
    "hero.seeDemo": "See demo",
    "hero.noApp": "No app to install",
    "hero.delivery": "Delivery in up to 7 business days",
    "hero.noContract": "No lock-in contract",

    "transformation.label": "The transformation",
    "transformation.title": "From file to interactive product in days",
    "transformation.youSend": "You send",
    "transformation.weDeliver": "We deliver",
    "transformation.avgTime": "Average time: 7 business days",
    "transformation.footer": "From client file to interactive product in Augmented Reality",

    "send.jpg": "Product photos",
    "send.skp": "CAD / SketchUp file",
    "send.pdf": "Finishes catalog",
    "send.dwg": "Technical sheets",

    "deliver.model": "Interactive 3D model",
    "deliver.model.desc": "Browser-navigable, no app",
    "deliver.customizer": "Finish customizer",
    "deliver.customizer.desc": "Colors and materials in real time",
    "deliver.ar": "Augmented Reality",
    "deliver.ar.desc": "QR code → product at real scale",
    "deliver.global": "Global publishing",
    "deliver.global.desc": "Visible to architects in 40+ countries",
    "deliver.analytics": "Usage analytics",
    "deliver.analytics.desc": "See who specified your product",

    "numbers.countries": "countries reached",
    "numbers.brands": "brands on the platform",
    "numbers.downloads": "downloads per month",
    "numbers.delivery": "average delivery time",

    "howItWorks.label": "How it works",
    "howItWorks.title": "Simple for you. Impressive for your client.",
    "howItWorks.subtitle": "You don't need to know anything about 3D. Just send your materials — we take care of the rest.",

    "steps.s1.title": "You send the files",
    "steps.s1.desc": "Product photos, CAD files, technical sheets and finishes catalog — all through the portal, at your own pace.",
    "steps.s2.title": "We transform it into 3D",
    "steps.s2.desc": "Our team models, textures and configures each product. You track progress and approve before publishing.",
    "steps.s3.title": "Your product reaches the world",
    "steps.s3.desc": "Published on the platform with embed for your site, QR code for AR and visibility for architects globally.",

    "benefits.label": "Why ArchTechTour",
    "benefits.title": "What changes for your brand",

    "benefits.b1.title": "From project to interactive 3D",
    "benefits.b1.desc": "Send photos, CAD or technical drawings and our team delivers your product as a configurable 3D block — without you touching any software.",
    "benefits.b2.title": "Visible to architects worldwide",
    "benefits.b2.desc": "Your products become available on the ArchTechTour platform, used by architecture professionals in over 40 countries to specify and purchase.",
    "benefits.b3.title": "Augmented Reality in the architect's pocket",
    "benefits.b3.desc": "With a QR code, the architect positions your furniture at real scale in the client's environment — directly from their phone, no app, no training.",
    "benefits.b4.title": "Finish customizer",
    "benefits.b4.desc": "The end customer chooses color, cladding and material in real time on the 3D model. You sell more without needing all finishes in stock.",

    "testimonials.label": "Real results",
    "testimonials.title": "What our clients say",

    "clients.label": "Brands already in digital 3D",

    "plans.label": "Plans & pricing",
    "plans.title": "Start today, no salesperson",
    "plans.subtitle": "Subscribe online, pay by card and start onboarding the same day.",
    "plans.popular": "Most popular",
    "plans.startNow": "Start now",
    "plans.talkTeam": "Talk to the team",
    "plans.perMonth": "/month",
    "plans.underConsult": "Custom pricing",

    "plans.starter.desc": "Ideal for brands starting in digital 3D.",
    "plans.starter.products": "10 products in 3D",
    "plans.pro.desc": "For medium catalogs with AR customizer.",
    "plans.pro.products": "50 products in 3D",
    "plans.enterprise.desc": "Unlimited volume with dedicated manager.",

    "testimonial.1.quote": "In 3 weeks we had 40 products in 3D on the platform. Architects from São Paulo to Lisbon are already specifying our line.",
    "testimonial.1.role": "Commercial Director · Escal Móveis",
    "testimonial.2.quote": "The AR customizer became our main sales argument. The client sees the sofa in their living room before buying.",
    "testimonial.2.role": "CEO · Estúdio Bola",
    "testimonial.3.quote": "We cut the B2B sales cycle in half. Architects specify our products without needing to visit the showroom.",
    "testimonial.3.role": "Marketing Manager · Tidelli",

    "plans.f1": "Tracking portal",
    "plans.f2": "Online approval",
    "plans.f3": "Automatic invoice",
    "plans.f4": "Email support",
    "plans.f5": "AR customizer",
    "plans.f6": "Finish variations",
    "plans.f7": "Advanced analytics",
    "plans.f8": "Priority support",
    "plans.f9": "Dedicated account manager",
    "plans.f10": "Contractual SLA guarantee",
    "plans.f11": "Custom integration",
    "plans.f12": "Executive reports",
    "plans.f13": "Invoice & international billing",
    "plans.f14": "Unlimited products",

    "cta.badge": "First blocks delivered in up to 7 business days",
    "cta.title1": "Ready to take your catalog to the",
    "cta.title2": "digital 3D world?",
    "cta.subtitle": "Choose your plan, subscribe in minutes and start onboarding today — no salesperson, no mandatory meeting.",
    "cta.seePlans": "See plans",
    "cta.talkTeam": "Talk to the team",

    "footer.tagline": "3D & AR for design brands",
    "footer.terms": "Terms of use",
    "footer.privacy": "Privacy",

    "video.title": "Video in production",
    "video.desc": "We're producing a video showing the complete transformation — from project to interactive 3D with Augmented Reality.",
    "video.requestDemo": "Request live demo",

    "portal.title": "Analytics",
    "portal.refresh": "Refresh",
    "portal.users": "Unique users",
    "portal.sessions": "Sessions",
    "portal.events": "Events",
    "portal.products": "Engaged products",
    "portal.loading": "Loading...",
    "portal.noData": "No data for this period",
    "portal.selectClient": "Select client",
    "portal.selectPeriod": "Period",
    "portal.apply": "Apply",
    "portal.logout": "Logout",
  },
  es: {
    "nav.howItWorks": "Cómo funciona",
    "nav.benefits": "Beneficios",
    "nav.plans": "Planes",
    "nav.clients": "Clientes",
    "nav.login": "Entrar",
    "nav.startNow": "Comenzar ahora",

    "hero.badge": "Más de 500 marcas de muebles y diseño en la plataforma",
    "hero.title1": "Tu producto en 3D interactivo",
    "hero.title2": "y Realidad Aumentada —",
    "hero.title3": "para arquitectos de todo el mundo",
    "hero.subtitle": "Transformamos catálogos de muebles y revestimientos en experiencias digitales inmersivas. Tu cliente ve, personaliza y especifica — sin moverse del lugar.",
    "hero.seePlans": "Ver planes y precios",
    "hero.seeDemo": "Ver demo",
    "hero.noApp": "Sin app para instalar",
    "hero.delivery": "Entrega en hasta 7 días hábiles",
    "hero.noContract": "Sin contrato de fidelidad",

    "transformation.label": "La transformación",
    "transformation.title": "Del archivo al producto interactivo en días",
    "transformation.youSend": "Tú envías",
    "transformation.weDeliver": "Nosotros entregamos",
    "transformation.avgTime": "Plazo promedio: 7 días hábiles",
    "transformation.footer": "Del archivo del cliente al producto interactivo en Realidad Aumentada",

    "send.jpg": "Fotos del producto",
    "send.skp": "Archivo CAD / SketchUp",
    "send.pdf": "Catálogo de acabados",
    "send.dwg": "Fichas técnicas",

    "deliver.model": "Modelo 3D interactivo",
    "deliver.model.desc": "Navegable en el browser, sin app",
    "deliver.customizer": "Personalizador de acabados",
    "deliver.customizer.desc": "Colores y materiales en tiempo real",
    "deliver.ar": "Realidad Aumentada",
    "deliver.ar.desc": "QR code → producto a escala real",
    "deliver.global": "Publicación global",
    "deliver.global.desc": "Visible para arquitectos en 40+ países",
    "deliver.analytics": "Analytics de uso",
    "deliver.analytics.desc": "Ve quién especificó tu producto",

    "numbers.countries": "países alcanzados",
    "numbers.brands": "marcas en la plataforma",
    "numbers.downloads": "descargas por mes",
    "numbers.delivery": "plazo promedio de entrega",

    "howItWorks.label": "Cómo funciona",
    "howItWorks.title": "Simple para ti. Impresionante para tu cliente.",
    "howItWorks.subtitle": "No necesitas saber nada de 3D. Solo envía tus materiales — nosotros nos encargamos del resto.",

    "steps.s1.title": "Tú envías los archivos",
    "steps.s1.desc": "Fotos del producto, archivos CAD, fichas técnicas y catálogo de acabados — todo por el portal, a tu ritmo.",
    "steps.s2.title": "Nosotros lo transformamos en 3D",
    "steps.s2.desc": "Nuestro equipo modela, texturiza y configura cada producto. Tú sigues el progreso y apruebas antes de publicar.",
    "steps.s3.title": "Tu producto llega al mundo",
    "steps.s3.desc": "Publicado en la plataforma con embed para tu sitio, QR code para RA y visibilidad para arquitectos globalmente.",

    "benefits.label": "Por qué ArchTechTour",
    "benefits.title": "Qué cambia para tu marca",

    "benefits.b1.title": "Del proyecto al 3D interactivo",
    "benefits.b1.desc": "Envía fotos, CAD o dibujos técnicos y nuestro equipo entrega tu producto como un bloque 3D configurable — sin que toques ningún software.",
    "benefits.b2.title": "Visible para arquitectos de todo el mundo",
    "benefits.b2.desc": "Tus productos quedan disponibles en la plataforma ArchTechTour, usada por profesionales de arquitectura en más de 40 países para especificar y comprar.",
    "benefits.b3.title": "Realidad Aumentada en el bolsillo del arquitecto",
    "benefits.b3.desc": "Con un QR code, el arquitecto posiciona tu mueble a escala real en el ambiente del cliente — directo desde el celular, sin app, sin entrenamiento.",
    "benefits.b4.title": "Personalizador de acabados",
    "benefits.b4.desc": "El cliente final elige color, revestimiento y material en tiempo real en el modelo 3D. Vendes más sin necesitar todos los acabados en stock.",

    "testimonials.label": "Resultados reales",
    "testimonials.title": "Lo que dicen nuestros clientes",

    "clients.label": "Marcas que ya están en el digital 3D",

    "plans.label": "Planes y precios",
    "plans.title": "Empieza hoy, sin vendedor",
    "plans.subtitle": "Suscríbete online, paga con tarjeta e inicia el onboarding el mismo día.",
    "plans.popular": "Más popular",
    "plans.startNow": "Comenzar ahora",
    "plans.talkTeam": "Hablar con el equipo",
    "plans.perMonth": "/mes",
    "plans.underConsult": "Precio a consultar",

    "plans.starter.desc": "Ideal para marcas que inician en el 3D digital.",
    "plans.starter.products": "10 productos en 3D",
    "plans.pro.desc": "Para catálogos medianos con personalizador de RA.",
    "plans.pro.products": "50 productos en 3D",
    "plans.enterprise.desc": "Volumen ilimitado con gerente dedicado.",

    "testimonial.1.quote": "En 3 semanas teníamos 40 productos en 3D en la plataforma. Arquitectos de São Paulo a Lisboa ya están especificando nuestra línea.",
    "testimonial.1.role": "Directora Comercial · Escal Móveis",
    "testimonial.2.quote": "El personalizador de RA se convirtió en nuestro principal argumento de venta. El cliente ve el sofá en su sala antes de comprar.",
    "testimonial.2.role": "CEO · Estúdio Bola",
    "testimonial.3.quote": "Reducimos el ciclo de ventas B2B a la mitad. Los arquitectos especifican nuestros productos sin necesitar visitar el showroom.",
    "testimonial.3.role": "Gerente de Marketing · Tidelli",

    "plans.f1": "Portal de seguimiento",
    "plans.f2": "Aprobación online",
    "plans.f3": "Factura automática",
    "plans.f4": "Soporte por e-mail",
    "plans.f5": "Personalizador de RA",
    "plans.f6": "Variaciones de acabado",
    "plans.f7": "Analytics avanzado",
    "plans.f8": "Soporte prioritario",
    "plans.f9": "Gerente de cuenta dedicado",
    "plans.f10": "SLA garantizado en contrato",
    "plans.f11": "Integración personalizada",
    "plans.f12": "Informes ejecutivos",
    "plans.f13": "NF-e e Factura internacional",
    "plans.f14": "Productos ilimitados",

    "cta.badge": "Primeros bloques entregados en hasta 7 días hábiles",
    "cta.title1": "¿Listo para llevar tu catálogo al",
    "cta.title2": "mundo digital 3D?",
    "cta.subtitle": "Elige tu plan, suscríbete en minutos y empieza el onboarding hoy — sin vendedor, sin reunión obligatoria.",
    "cta.seePlans": "Ver planes",
    "cta.talkTeam": "Hablar con el equipo",

    "footer.tagline": "3D & RA para marcas de diseño",
    "footer.terms": "Términos de uso",
    "footer.privacy": "Privacidad",

    "video.title": "Vídeo en producción",
    "video.desc": "Estamos produciendo un video mostrando la transformación completa — del proyecto al 3D interactivo con Realidad Aumentada.",
    "video.requestDemo": "Solicitar demo en vivo",

    "portal.title": "Analytics",
    "portal.refresh": "Actualizar",
    "portal.users": "Usuarios únicos",
    "portal.sessions": "Sesiones",
    "portal.events": "Eventos",
    "portal.products": "Productos con engagement",
    "portal.loading": "Cargando...",
    "portal.noData": "Sin datos para el período",
    "portal.selectClient": "Seleccionar cliente",
    "portal.selectPeriod": "Período",
    "portal.apply": "Aplicar",
    "portal.logout": "Salir",
  },
  fr: {
    "nav.howItWorks": "Comment ça marche",
    "nav.benefits": "Avantages",
    "nav.plans": "Plans",
    "nav.clients": "Clients",
    "nav.login": "Connexion",
    "nav.startNow": "Commencer",

    "hero.badge": "Plus de 500 marques de meubles et design sur la plateforme",
    "hero.title1": "Votre produit en 3D interactif",
    "hero.title2": "et Réalité Augmentée —",
    "hero.title3": "pour les architectes du monde entier",
    "hero.subtitle": "Nous transformons les catalogues de meubles en expériences digitales immersives. Votre client voit, personnalise et spécifie — sans bouger.",
    "hero.seePlans": "Voir les plans et tarifs",
    "hero.seeDemo": "Voir la démo",
    "hero.noApp": "Sans application à installer",
    "hero.delivery": "Livraison en 7 jours ouvrés",
    "hero.noContract": "Sans engagement",

    "transformation.label": "La transformation",
    "transformation.title": "Du fichier au produit interactif en quelques jours",
    "transformation.youSend": "Vous envoyez",
    "transformation.weDeliver": "Nous livrons",
    "transformation.avgTime": "Délai moyen: 7 jours ouvrés",
    "transformation.footer": "Du fichier client au produit interactif en Réalité Augmentée",

    "send.jpg": "Photos du produit",
    "send.skp": "Fichier CAD / SketchUp",
    "send.pdf": "Catalogue de finitions",
    "send.dwg": "Fiches techniques",

    "deliver.model": "Modèle 3D interactif",
    "deliver.model.desc": "Navigable dans le browser, sans app",
    "deliver.customizer": "Personnalisateur de finitions",
    "deliver.customizer.desc": "Couleurs et matériaux en temps réel",
    "deliver.ar": "Réalité Augmentée",
    "deliver.ar.desc": "QR code → produit à l'échelle réelle",
    "deliver.global": "Publication mondiale",
    "deliver.global.desc": "Visible pour les architectes dans 40+ pays",
    "deliver.analytics": "Analytics d'utilisation",
    "deliver.analytics.desc": "Voyez qui a spécifié votre produit",

    "numbers.countries": "pays atteints",
    "numbers.brands": "marques sur la plateforme",
    "numbers.downloads": "téléchargements par mois",
    "numbers.delivery": "délai moyen de livraison",

    "howItWorks.label": "Comment ça marche",
    "howItWorks.title": "Simple pour vous. Impressionnant pour vos clients.",
    "howItWorks.subtitle": "Vous n'avez pas besoin de savoir quoi que ce soit en 3D. Envoyez vos matériaux — nous nous occupons du reste.",

    "steps.s1.title": "Vous envoyez les fichiers",
    "steps.s1.desc": "Photos du produit, fichiers CAD, fiches techniques et catalogue de finitions — tout via le portail, à votre rythme.",
    "steps.s2.title": "Nous le transformons en 3D",
    "steps.s2.desc": "Notre équipe modélise, texturise et configure chaque produit. Vous suivez l'avancement et approuvez avant publication.",
    "steps.s3.title": "Votre produit atteint le monde",
    "steps.s3.desc": "Publié sur la plateforme avec intégration pour votre site, QR code pour RA et visibilité pour les architectes mondialement.",

    "benefits.label": "Pourquoi ArchTechTour",
    "benefits.title": "Ce qui change pour votre marque",

    "benefits.b1.title": "Du projet au 3D interactif",
    "benefits.b1.desc": "Envoyez des photos, CAD ou dessins techniques et notre équipe livre votre produit en tant que bloc 3D configurable — sans toucher aucun logiciel.",
    "benefits.b2.title": "Visible aux architectes du monde entier",
    "benefits.b2.desc": "Vos produits sont disponibles sur la plateforme ArchTechTour, utilisée par des professionnels de l'architecture dans plus de 40 pays.",
    "benefits.b3.title": "Réalité Augmentée dans la poche de l'architecte",
    "benefits.b3.desc": "Avec un QR code, l'architecte positionne votre meuble à l'échelle réelle dans l'environnement du client — directement depuis son téléphone, sans app.",
    "benefits.b4.title": "Personnalisateur de finitions",
    "benefits.b4.desc": "Le client final choisit couleur, revêtement et matériau en temps réel sur le modèle 3D. Vous vendez plus sans avoir besoin de tous les finitions en stock.",

    "testimonials.label": "Résultats réels",
    "testimonials.title": "Ce que disent nos clients",

    "clients.label": "Marques déjà dans le 3D numérique",

    "plans.label": "Plans et tarifs",
    "plans.title": "Commencez aujourd'hui, sans commercial",
    "plans.subtitle": "Abonnez-vous en ligne, payez par carte et démarrez l'onboarding le même jour.",
    "plans.popular": "Le plus populaire",
    "plans.startNow": "Commencer maintenant",
    "plans.talkTeam": "Parler à l'équipe",
    "plans.perMonth": "/mois",
    "plans.underConsult": "Sur devis",

    "plans.starter.desc": "Idéal pour les marques débutant dans le 3D digital.",
    "plans.starter.products": "10 produits en 3D",
    "plans.pro.desc": "Pour les catalogues moyens avec personnalisateur RA.",
    "plans.pro.products": "50 produits en 3D",
    "plans.enterprise.desc": "Volume illimité avec manager dédié.",

    "testimonial.1.quote": "En 3 semaines nous avions 40 produits en 3D sur la plateforme. Des architectes de São Paulo à Lisbonne spécifient déjà notre gamme.",
    "testimonial.1.role": "Directrice Commerciale · Escal Móveis",
    "testimonial.2.quote": "Le personnalisateur RA est devenu notre principal argument de vente. Le client voit le canapé dans son salon avant d'acheter.",
    "testimonial.2.role": "CEO · Estúdio Bola",
    "testimonial.3.quote": "Nous avons réduit de moitié le cycle de vente B2B. Les architectes spécifient nos produits sans avoir à visiter le showroom.",
    "testimonial.3.role": "Responsable Marketing · Tidelli",

    "plans.f1": "Portail de suivi",
    "plans.f2": "Approbation en ligne",
    "plans.f3": "Facture automatique",
    "plans.f4": "Support par e-mail",
    "plans.f5": "Personnalisateur RA",
    "plans.f6": "Variations de finitions",
    "plans.f7": "Analytics avancé",
    "plans.f8": "Support prioritaire",
    "plans.f9": "Responsable de compte dédié",
    "plans.f10": "SLA garanti par contrat",
    "plans.f11": "Intégration personnalisée",
    "plans.f12": "Rapports exécutifs",
    "plans.f13": "Facture nationale et internationale",
    "plans.f14": "Produits illimités",

    "cta.badge": "Premiers blocs livrés en 7 jours ouvrés",
    "cta.title1": "Prêt à emmener votre catalogue dans le",
    "cta.title2": "monde digital 3D?",
    "cta.subtitle": "Choisissez votre plan, abonnez-vous en quelques minutes et démarrez l'onboarding aujourd'hui — sans commercial, sans réunion obligatoire.",
    "cta.seePlans": "Voir les plans",
    "cta.talkTeam": "Parler à l'équipe",

    "footer.tagline": "3D & RA pour les marques de design",
    "footer.terms": "Conditions d'utilisation",
    "footer.privacy": "Confidentialité",

    "video.title": "Vidéo en production",
    "video.desc": "Nous produisons une vidéo montrant la transformation complète — du projet au 3D interactif avec Réalité Augmentée.",
    "video.requestDemo": "Demander une démo en direct",

    "portal.title": "Analytics",
    "portal.refresh": "Actualiser",
    "portal.users": "Utilisateurs uniques",
    "portal.sessions": "Sessions",
    "portal.events": "Événements",
    "portal.products": "Produits engagés",
    "portal.loading": "Chargement...",
    "portal.noData": "Aucune donnée pour cette période",
    "portal.selectClient": "Sélectionner un client",
    "portal.selectPeriod": "Période",
    "portal.apply": "Appliquer",
    "portal.logout": "Déconnexion",
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────
interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "pt",
  setLang: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("pt");

  useEffect(() => {
    const stored = localStorage.getItem("att-lang") as Lang | null;
    if (stored && ["pt", "en", "es", "fr"].includes(stored)) {
      setLangState(stored);
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("att-lang", l);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  const { lang } = useLanguage();
  return (key: string): string => {
    return translations[lang]?.[key] ?? translations["pt"][key] ?? key;
  };
}
