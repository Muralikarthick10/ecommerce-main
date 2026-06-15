import json

from django.conf import settings

from .models import Category, CartItem, WishlistItem


def shop_context(request):
    """Inject globally useful data into every template."""
    cart_count = 0
    wishlist_count = 0
    wishlist_ids = []
    if request.user.is_authenticated:
        cart_count = CartItem.objects.filter(user=request.user).count()
        wishlist_ids = list(
            WishlistItem.objects.filter(user=request.user).values_list("product_id", flat=True)
        )
        wishlist_count = len(wishlist_ids)

    firebase_config = getattr(settings, "FIREBASE_CONFIG", {}) or {}
    firebase_enabled = bool(firebase_config.get("apiKey") and firebase_config.get("projectId"))

    return {
        "nav_categories": Category.objects.filter(is_active=True).order_by("name"),
        "cart_count": cart_count,
        "wishlist_count": wishlist_count,
        "wishlist_ids": wishlist_ids,
        "firebase_config_json": json.dumps(firebase_config),
        "firebase_enabled": firebase_enabled,
    }