import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PageTransition from '../../components/common/PageTransition';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Button from '../../components/common/Button';
import MediaUpload from '../../components/common/MediaUpload';
import { stadiumApi } from '../../api/stadiumApi';

export default function OwnerStadiumForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    city: '',
    region: '',
    area: '',
    address: '',
    lat: '',
    lng: '',
    images: [],
    openingTime: '06:00',
    closingTime: '23:00',
    facilities: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const facilities = form.facilities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const { data } = await stadiumApi.create({
        name: form.name,
        description: form.description,
        images: form.images,
        openingTime: form.openingTime,
        closingTime: form.closingTime,
        facilities,
        location: {
          city: form.city,
          region: form.region,
          area: form.area,
          address: form.address,
          lat: form.lat ? Number(form.lat) : undefined,
          lng: form.lng ? Number(form.lng) : undefined,
        },
      });
      toast.success('Stadium submitted for admin review!');
      navigate(`/owner/stadiums/${data.data.stadium._id}`);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to create stadium');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition className="mx-auto max-w-xl">
      <h1 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">Add a stadium</h1>
      <p className="mt-1 text-sm text-muted dark:text-dark-muted">
        Register as Stadium Owner → create stadium with location, GPS, images, and hours. Then add fields and managers.
      </p>

      <Card className="mt-6 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Stadium name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea
            label="Description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Area / neighborhood" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            <Input label="Street address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              type="number"
              step="any"
              placeholder="2.0469"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              placeholder="45.3182"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
            />
          </div>
          <Input
            label="Facilities (comma-separated)"
            placeholder="parking, lighting, showers"
            value={form.facilities}
            onChange={(e) => setForm({ ...form, facilities: e.target.value })}
          />
          <MediaUpload
            folder="stadiums"
            accept="image/*,video/*"
            multiple
            maxFiles={12}
            label="Stadium photos & videos"
            hint="Upload pitch photos, entrance, lighting, or short promo clips (Cloudinary)."
            value={form.images}
            onChange={(images) => setForm({ ...form, images })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Opening time"
              type="time"
              value={form.openingTime}
              onChange={(e) => setForm({ ...form, openingTime: e.target.value })}
            />
            <Input
              label="Closing time"
              type="time"
              value={form.closingTime}
              onChange={(e) => setForm({ ...form, closingTime: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" loading={saving}>
            Submit stadium
          </Button>
        </form>
      </Card>
    </PageTransition>
  );
}
