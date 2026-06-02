type Destination = {
  id: string;
  name: string;
  location: string;
  rating: number;
  image: string;
  imageAlt: string;
  description: string;
  bestTime: string;
  attractions: string[];
  budget: string;
  duration: string;
};

type DestinationCardProps = {
  destination: Destination;
  onSelect: (destination: Destination) => void;
};

function DestinationCard({ destination, onSelect }: DestinationCardProps) {
  return (
    <article className="destination-card" onClick={() => onSelect(destination)} onKeyDown={(event) => event.key === 'Enter' && onSelect(destination)} tabIndex={0} role="button" aria-label={`View details for ${destination.name}`}>
      <div className="destination-card-image">
        <img src={destination.image} alt={destination.imageAlt} />
      </div>
      <div className="destination-content">
        <div>
          <p className="destination-label">{destination.name}</p>
          <p className="destination-subtitle">{destination.location}</p>
        </div>
        <span className="rating">{destination.rating.toFixed(1)}</span>
      </div>
    </article>
  );
}

type DestinationModalProps = {
  destination: Destination | null;
  isVisible: boolean;
  onClose: () => void;
};

function DestinationModal({ destination, isVisible, onClose }: DestinationModalProps) {
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!destination) {
    return null;
  }

  return (
    <div className={`destination-modal-overlay ${isVisible ? 'open' : ''}`} onClick={onClose}>
      <div className={`destination-modal ${isVisible ? 'open' : ''}`} onClick={(event) => event.stopPropagation()}>
        <button className="destination-modal-close" onClick={onClose} aria-label="Close destination details">
          ✕
        </button>
        <div className="destination-modal-image">
          <img src={destination.image} alt={destination.imageAlt} />
        </div>
        <div className="destination-modal-content">
          <div className="destination-modal-header">
            <div>
              <span className="eyebrow">Destination</span>
              <h2>{destination.name}</h2>
              <p className="destination-subtitle">{destination.location}</p>
            </div>
            <span className="rating">{destination.rating.toFixed(1)}</span>
          </div>
          <div className="destination-modal-body">
            <div className="destination-modal-block">
              <h3>Description</h3>
              <p>{destination.description}</p>
            </div>
            <div className="destination-modal-grid">
              <div className="destination-modal-block">
                <h3>Best Time to Visit</h3>
                <p>{destination.bestTime}</p>
              </div>
              <div className="destination-modal-block">
                <h3>Recommended Duration</h3>
                <p>{destination.duration}</p>
              </div>
              <div className="destination-modal-block">
                <h3>Estimated Budget</h3>
                <p>{destination.budget}</p>
              </div>
              <div className="destination-modal-block">
                <h3>Top Attractions</h3>
                <ul>
                  {destination.attractions.map((attraction) => (
                    <li key={attraction}>{attraction}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DestinationSection() {
  const destinations = ((window as any).travelDestinations as Destination[]) || [];
  const [selectedDestination, setSelectedDestination] = React.useState<Destination | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);

  React.useEffect(() => {
    if (selectedDestination) {
      setModalVisible(true);
    }
  }, [selectedDestination]);

  const closeModal = React.useCallback(() => {
    setModalVisible(false);
  }, []);

  React.useEffect(() => {
    if (!modalVisible && selectedDestination) {
      const timer = window.setTimeout(() => setSelectedDestination(null), 220);
      return () => window.clearTimeout(timer);
    }
    return;
  }, [modalVisible, selectedDestination]);

  return (
    <>
      <div className="destination-grid">
        {destinations.map((destination) => (
          <DestinationCard key={destination.id} destination={destination} onSelect={setSelectedDestination} />
        ))}
      </div>
      <DestinationModal destination={selectedDestination} isVisible={modalVisible} onClose={closeModal} />
    </>
  );
}

const destinationRoot = document.getElementById('destination-root');
if (destinationRoot) {
  ReactDOM.createRoot(destinationRoot).render(<DestinationSection />);
}
