import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { nutritionApi } from '../../../api/nutrition';
import { Plus, Search, Trash2, Edit3, Globe, Building2 } from 'lucide-react';
import Modal from '../../../components/Modal';

const CATEGORIES = ['Protein', 'Carbohydrate', 'Vegetable', 'Fruit', 'Dairy', 'Beverage', 'Healthy Fat', 'Supplement', 'Other'];
const CAT_COLORS = {
    Protein: '#EF4444', Carbohydrate: '#F59E0B', Vegetable: '#22C55E', Fruit: '#EC4899',
    Dairy: '#3B82F6', Beverage: '#06B6D4', 'Healthy Fat': '#8B5CF6', Supplement: '#14B8A6', Other: '#6B7280'
};
const emptyFood = { name: '', category: '', servingSize: '', servingUnit: 'g', calories: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '', sodium: '' };

const FoodDatabasePanel = () => {
    const { facilitySubscription } = useAuth();
    const { addToast, showConfirm } = useToast();
    const facilityId = facilitySubscription?.id;

    const [foods, setFoods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('All');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState(emptyFood);

    useEffect(() => { loadFoods(); }, [facilityId]);

    const loadFoods = async () => {
        try {
            setLoading(true);
            setFoods(await nutritionApi.getFoods(facilityId));
        } catch (e) { addToast('Failed to load foods', 'error'); }
        finally { setLoading(false); }
    };

    const openAdd = () => { setEditingId(null); setFormData(emptyFood); setShowModal(true); };
    const openEdit = (food) => {
        setEditingId(food.id);
        setFormData({
            name: food.name || '', category: food.category || '', servingSize: food.servingSize ?? '',
            servingUnit: food.servingUnit || 'g', calories: food.calories ?? '', protein: food.protein ?? '',
            carbs: food.carbs ?? '', fat: food.fat ?? '', fiber: food.fiber ?? '', sugar: food.sugar ?? '', sodium: food.sodium ?? ''
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (editingId) { await nutritionApi.updateFood(editingId, formData); addToast('Food updated', 'success'); }
            else { await nutritionApi.createFood({ ...formData, facilityId }); addToast('Food added', 'success'); }
            setShowModal(false);
            loadFoods();
        } catch (e) { addToast(editingId ? 'Failed to update food' : 'Failed to add food', 'error'); }
    };

    const handleDelete = (food) => showConfirm(`Delete "${food.name}" from the food database?`, async () => {
        try { await nutritionApi.deleteFood(food.id); addToast('Food deleted', 'success'); loadFoods(); }
        catch (e) { addToast('Failed to delete food', 'error'); }
    }, 'Delete Food');

    const filtered = useMemo(() => foods.filter((f) =>
        (catFilter === 'All' || f.category === catFilter) &&
        f.name.toLowerCase().includes(search.toLowerCase())
    ), [foods, search, catFilter]);

    const macroChip = (label, val, color) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.8rem', fontWeight: 600, color }}>
            {label}<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{Number(val || 0).toFixed(0)}g</span>
        </span>
    );

    return (
        <div>
            {/* Search + category filter */}
            <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="search-bar" style={{ flex: 1, minWidth: 220 }}>
                        <Search size={18} style={{ color: 'var(--text-secondary)', marginRight: '0.5rem' }} />
                        <input type="text" placeholder="Search foods…" value={search} onChange={(e) => setSearch(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-main)' }} />
                    </div>
                    <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Food</button>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', overflowX: 'auto', paddingBottom: 4 }}>
                    {['All', ...CATEGORIES].map((c) => {
                        const active = catFilter === c;
                        return (
                            <button key={c} onClick={() => setCatFilter(c)} style={{
                                whiteSpace: 'nowrap', padding: '5px 12px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                border: `1px solid ${active ? 'transparent' : 'var(--border-color)'}`,
                                background: active ? (c === 'All' ? 'var(--primary)' : CAT_COLORS[c]) : 'transparent',
                                color: active ? '#fff' : 'var(--text-secondary)'
                            }}>{c}</button>
                        );
                    })}
                </div>
            </div>

            <div className="card">
                {loading ? (
                    <div className="loader-container" style={{ minHeight: 200 }}><div className="loader-icon" /></div>
                ) : (
                    <div className="table-responsive" style={{ padding: '0.5rem' }}>
                        <table className="modern-table">
                            <thead><tr>
                                <th>Name</th><th>Category</th><th>Serving</th><th>Calories</th><th>Protein · Carbs · Fat</th><th style={{ textAlign: 'right' }}>Actions</th>
                            </tr></thead>
                            <tbody>
                                {filtered.map((food) => (
                                    <tr key={food.id}>
                                        <td style={{ fontWeight: 600 }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                {food.facilityId ? <Building2 size={13} style={{ color: 'var(--text-muted)' }} title="Facility food" /> : <Globe size={13} style={{ color: 'var(--text-muted)' }} title="Global food" />}
                                                {food.name}
                                            </span>
                                        </td>
                                        <td><span className="status-badge" style={{ background: `${CAT_COLORS[food.category] || '#6B7280'}22`, color: CAT_COLORS[food.category] || '#6B7280', padding: '3px 10px', borderRadius: 8 }}>{food.category}</span></td>
                                        <td className="text-secondary">{food.servingSize} {food.servingUnit}</td>
                                        <td style={{ fontWeight: 700, color: 'var(--text-highlight)' }}>{Number(food.calories || 0).toFixed(0)} kcal</td>
                                        <td style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 14 }}>
                                            {macroChip('P', food.protein, '#EF4444')}
                                            {macroChip('C', food.carbs, '#F59E0B')}
                                            {macroChip('F', food.fat, '#8B5CF6')}
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {!food.facilityId ? (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Global</span>
                                            ) : (
                                                <>
                                                    <button className="icon-btn" onClick={() => openEdit(food)} title="Edit"><Edit3 size={16} /></button>
                                                    <button className="icon-btn" onClick={() => handleDelete(food)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No foods match your filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Food' : 'Add Food Item'}>
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group">
                        <label className="input-label">Food Name</label>
                        <input type="text" className="input-field" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Chicken Breast" />
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="input-group" style={{ flex: 1.4 }}>
                            <label className="input-label">Category</label>
                            <select className="input-field" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required>
                                <option value="" disabled>Select…</option>
                                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label className="input-label">Serving Size</label>
                            <input type="number" step="any" className="input-field" value={formData.servingSize} onChange={(e) => setFormData({ ...formData, servingSize: e.target.value })} required />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label className="input-label">Unit</label>
                            <input list="servingUnits" className="input-field" value={formData.servingUnit} onChange={(e) => setFormData({ ...formData, servingUnit: e.target.value })} placeholder="g, piece…" required />
                            <datalist id="servingUnits"><option value="g" /><option value="ml" /><option value="piece" /><option value="cup" /><option value="tbsp" /><option value="medium" /><option value="slice" /><option value="plate" /></datalist>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="input-group" style={{ flex: 1 }}><label className="input-label">Calories</label><input type="number" step="any" className="input-field" value={formData.calories} onChange={(e) => setFormData({ ...formData, calories: e.target.value })} required /></div>
                        <div className="input-group" style={{ flex: 1 }}><label className="input-label">Protein (g)</label><input type="number" step="any" className="input-field" value={formData.protein} onChange={(e) => setFormData({ ...formData, protein: e.target.value })} required /></div>
                        <div className="input-group" style={{ flex: 1 }}><label className="input-label">Carbs (g)</label><input type="number" step="any" className="input-field" value={formData.carbs} onChange={(e) => setFormData({ ...formData, carbs: e.target.value })} required /></div>
                        <div className="input-group" style={{ flex: 1 }}><label className="input-label">Fat (g)</label><input type="number" step="any" className="input-field" value={formData.fat} onChange={(e) => setFormData({ ...formData, fat: e.target.value })} required /></div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="input-group" style={{ flex: 1 }}><label className="input-label">Fiber (g) <span style={{ color: 'var(--text-muted)' }}>opt.</span></label><input type="number" step="any" className="input-field" value={formData.fiber} onChange={(e) => setFormData({ ...formData, fiber: e.target.value })} /></div>
                        <div className="input-group" style={{ flex: 1 }}><label className="input-label">Sugar (g) <span style={{ color: 'var(--text-muted)' }}>opt.</span></label><input type="number" step="any" className="input-field" value={formData.sugar} onChange={(e) => setFormData({ ...formData, sugar: e.target.value })} /></div>
                        <div className="input-group" style={{ flex: 1 }}><label className="input-label">Sodium (mg) <span style={{ color: 'var(--text-muted)' }}>opt.</span></label><input type="number" step="any" className="input-field" value={formData.sodium} onChange={(e) => setFormData({ ...formData, sodium: e.target.value })} /></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                        <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                        <button type="submit" className="btn btn-primary">{editingId ? 'Update Food' : 'Save Food'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default FoodDatabasePanel;
